/**
 * Message contract between Flex plugin (parent) and Angular app (child iframe in CRM Container)
 *
 * ARCHITECTURE:
 * ┌────────────────────────────────────────────┐
 * │  Flex UI (https://flex.twilio.com)        │  ← PARENT (plugin runs here)
 * │                                            │
 * │  [Tasks] [Chat]  │  CRM Container          │
 * │                  │  ┌──────────────────┐   │
 * │                  │  │ <iframe>         │   │
 * │                  │  │ Angular App      │   │  ← CHILD (receives messages)
 * │                  │  │ (d30l3...)       │   │
 * │                  │  └──────────────────┘   │
 * └────────────────────────────────────────────┘
 */

// Messages sent FROM Flex plugin (parent) TO Angular app (child iframe)
export type FlexToAngularMessage = {
  type: FlexEvents.TASK_SELECTED | FlexEvents.OUTBOUND_CALL_ENDED;
  task: { sid: string };
  agent: { workerSid: string };
};

// Messages sent FROM Angular app (child iframe) TO Flex plugin (parent)
// Future use - currently not needed for iframe refresh fix
export type AngularToFlexMessage = {
  type: "IFRAME_READY";
};

export enum FlexEvents {
  TASK_SELECTED = "TASK_SELECTED",
  MAKE_OUTBOUND_CALL = "MAKE_OUTBOUND_CALL",
  OUTBOUND_CALL_ENDED = "OUTBOUND_CALL_ENDED",
}
