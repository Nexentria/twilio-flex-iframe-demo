import { FlexPlugin } from "@twilio/flex-plugin";
import * as Flex from "@twilio/flex-ui";
import { crmBridge } from "./services/CRMBridgeService";
import { FlexEvents } from "./types/messages";

const PLUGIN_NAME = "TwilioFlexIframeDemoPlugin";

export default class TwilioFlexIframeDemoPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  async init(flex: typeof Flex, manager: Flex.Manager) {
    // Register message listener for Angular app events
    window.addEventListener("message", this.handleAngularMessage);

    flex.CRMContainer.defaultProps.uriCallback = () => {
      return "https://sandbox.nexentria.com/medical/inquiries";
    };

    flex.AgentDesktopView.defaultProps.panel2ViewProps = {
      showCRMContainer: true,
    };

    // ──────────────────────────────────────────────────────────────────────
    // Reusable recording configuration
    // ──────────────────────────────────────────────────────────────────────
    // Using: record + recordingStatusCallback (simpler than conference-prefixed versions)
    //
    // NOTE: Twilio sends the following data in recording callback POST body:
    // - CallSid: The worker participant call SID (what you need!)
    // - ConferenceSid: The conference SID
    // - RecordingSid: The recording SID
    // - RecordingUrl: URL to download the recording
    // - RecordingStatus: "in-progress", "completed", "absent"
    // - RecordingDuration: Duration in seconds
    // Even if we pass taskSid in URL, the actual call SIDs are in POST body!
    // ──────────────────────────────────────────────────────────────────────
    const applyRecordingConfiguration = (
      conferenceOptions: any,
      payload?: any,
    ) => {
      if (conferenceOptions) {
        console.log(">>> APPLYING RECORDING CONFIGURATION <<<");
        console.log(
          ">>> conferenceOptions BEFORE modification:",
          JSON.stringify(conferenceOptions, null, 2),
        );

        // Override Flex console setting that may have disabled recording
        conferenceOptions.conferenceRecord = "true";
        conferenceOptions.record = "true";
        conferenceOptions.recordingChannels = "dual";

        if (payload) {
          // Extract all possible CallSid options
          const conferenceSid = payload.task?.attributes?.conference?.sid;
          const callSid = payload.task?.attributes?.call_sid;
          const taskSid = payload.task?.taskSid;
          const direction = payload.task?.attributes?.direction;
          // Smart priority based on call direction:
          // INBOUND: call_sid is available and reliable
          // OUTBOUND: only taskSid available (worker call SID will be in callback POST body)
          const id =
            direction === "inbound"
              ? callSid || conferenceSid || taskSid // Inbound priority
              : taskSid || conferenceSid || callSid; // Outbound priority

          conferenceOptions.recordingStatusCallback = `https://x9vcwrf2j0.execute-api.eu-central-1.amazonaws.com/stage/flex/voice/recording/callback?original_call_sid=${id}`;
        } else {
          conferenceOptions.recordingStatusCallback =
            "https://x9vcwrf2j0.execute-api.eu-central-1.amazonaws.com/stage/flex/voice/recording/callback";
        }
      }
    };

    // ──────────────────────────────────────────────────────────────────────
    // Send task data to Angular via postMessage on task accept, outgoing call via Flex
    // ──────────────────────────────────────────────────────────────────────
    const workerClient = manager.workerClient;
    const notifyAngularOfTask = (task: Flex.ITask | undefined) => {
      if (!task) return;

      crmBridge.send({
        type:
          task?.attributes?.direction === "inbound"
            ? FlexEvents.TASK_SELECTED
            : FlexEvents.OUTBOUND_CALL_ENDED,
        agent: {
          ...workerClient?.attributes,
          workerSid: task.workerSid,
        },
        task: { ...task.attributes, sid: task.taskSid },
      });
    };

    flex.Actions.addListener("beforeAcceptTask", (payload) => {
      applyRecordingConfiguration(payload.conferenceOptions, payload);
    });

    // Listen for task acceptance (agent accepts new inbound task)
    flex.Actions.addListener("afterAcceptTask", (payload) => {
      applyRecordingConfiguration(payload.conferenceOptions, payload);
      if (payload.task.attributes?.direction === "inbound") {
        notifyAngularOfTask(payload.task);
      }
    });

    // Triggers after a call wraps up
    manager.events.addListener("taskWrapup", (task: Flex.ITask) => {
      if (task.attributes?.direction !== "outbound") return;
      notifyAngularOfOutboundCallEnd(task);
    });

    // ──────────────────────────────────────────────────────────────────────
    // Outbound pickup tracking (supports the taskWrapup listener above)
    // ──────────────────────────────────────────────────────────────────────
    // en3 only creates a call record once the customer answers (inf-cc's
    // ExecuteOutgoing.on_reservation_wrapup requires conference.participants.customer).
    // Notifying Angular for a call that never connected sends it looking for a
    // record that will never exist, so we track pickup and gate on it below.
    const outboundTasksWithPickup = new Set<string>();

    // `connecting` is the only reliable signal — `status` defaults to "joined"
    // even before the customer answers.
    const hasCustomerPickedUp = (task: Flex.ITask): boolean =>
      (task.conference?.participants ?? []).some(
        (participant) =>
          participant.participantType === "customer" &&
          participant.status === "joined" &&
          !participant.connecting,
      );

    // Latched live, not read at hangup time — the customer participant is
    // already gone from the conference by the time the call ends.
    // https://www.twilio.com/docs/flex/developer/ui/redux
    manager.store.subscribe(() => {
      manager.store.getState().flex.worker.tasks.forEach((task) => {
        if (task.attributes?.direction !== "outbound") return;
        if (outboundTasksWithPickup.has(task.taskSid)) return;
        if (!hasCustomerPickedUp(task)) return;

        console.log(
          "[TwilioFlexIframeDemoPlugin] Customer picked up outbound call",
          task.taskSid,
        );
        outboundTasksWithPickup.add(task.taskSid);
      });
    });

    function notifyAngularOfOutboundCallEnd(task: Flex.ITask) {
      const pickedUp =
        outboundTasksWithPickup.has(task.taskSid) || hasCustomerPickedUp(task);
      outboundTasksWithPickup.delete(task.taskSid);

      if (!pickedUp) {
        console.log(
          "[TwilioFlexIframeDemoPlugin] Outbound call ended without a pickup, " +
            "no en3 call task will be created — skipping OUTBOUND_CALL_ENDED",
          task.taskSid,
        );
        return;
      }

      notifyAngularOfTask(task);
    }

    // Canceled outbound attempts skip wrapup entirely — clear their latch here.
    manager.events.addListener("taskCompleted", (task: Flex.ITask) => {
      outboundTasksWithPickup.delete(task.taskSid);
    });
  }

  handleAngularMessage = (event: MessageEvent) => {
    if (event.data?.type !== FlexEvents.MAKE_OUTBOUND_CALL) return;

    const { destination, task_id, case_id, from } = event.data.payload;
    if (!destination) {
      console.error(
        "[TwilioFlexIframeDemoPlugin] Missing destination in OUTBOUND_CALL message",
      );
      return;
    }

    console.log(
      "[TwilioFlexIframeDemoPlugin] Starting outbound call to:",
      destination,
      "from:",
      from,
    );

    Flex.Actions.invokeAction("StartOutboundCall", {
      destination,
      callerId: from,
      taskAttributes: {
        name: destination,
        type: "outbound",
        initiatedFrom: "en3",
        ...(task_id && { task_id }),
        ...(case_id && { case_id }),
      },
    }).catch((err) => {
      console.error(
        "[TwilioFlexIframeDemoPlugin] StartOutboundCall failed",
        err,
      );
    });
  };
}