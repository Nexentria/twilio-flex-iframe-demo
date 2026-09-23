# Twilio Flex Integration Requirements

# En3 ↔︎ Twilio Flex Integration Requirements

## Purpose

This document lists the information, access, and configuration required from Customer’s Organization to enable and run the En3 integration with Twilio Flex.

---

## 1. Twilio / Flex Account

The integration requires the following:

| Requirement | Details |
| --- | --- |
| Flex Account SID | Twilio Account SID (`ACxxxx...`) |
| Authentication | Twilio Auth Token or, preferably, a dedicated Twilio API Key + Secret with the minimum permissions required for the integration |
| TaskRouter Workspace SID | Flex TaskRouter Workspace SID (`WSxxxx...`) |

---

## 2. Flex / TaskRouter Configuration

| Requirement | Details |
| --- | --- |
| TaskRouter Workspace | Workspace to be used by En3 |
| Voicemail Queue | A TaskQueue named exactly `Voicemail` |
| Workflow SID | Workflow used by the Flex flow |
| Voice Task Channel SID | Voice Task Channel used for Flex tasks |
| Task Timeout | Current TaskRouter task timeout value |

### TaskRouter Event Callback

The TaskRouter Workspace must be configured to send events to the En3 application.

**Callback URL:**

`POST {EN3_API_BASE}/flex/taskrouter/workspace/event_callback`

The following events are required:

- `task.created`
- `task.canceled`
- `task-queue.entered`
- `reservation.accepted`
- `reservation.rejected`
- `reservation.timeout`
- `reservation.canceled`
- `reservation.wrapup`

---

## 3. Agents / Workers

En3 associates Flex workers with En3 users using their email address. Therefore, the agent's Flex worker **email attribute must exactly match** their En3 login email.

The following information has to be shared from Twilio with En3:

| Information | Required |
| --- | --- |
| Agent email address | Yes |

---

## 4. Phone Numbers

The following information is required by En3:

| Requirement | Details |
| --- | --- |
| Phone numbers | Project phone numbers are configured in En3. This way we can map incoming calls from Twilio and set up tasks in corresponding projects. |

### Important

Each inbound number must be registered in En3 against its corresponding project.

---

## 5. IVR Configuration (Twilio Studio)

The IVR will be implemented as a **separate Twilio Studio Flow** within the Customer’s Twilio/Flex account.

The Studio Flow will handle the initial call interaction, including language selection, and route the call to the appropriate En3 workflow.

### En3 Configuration

Nexentria creates and provides a Studio Flow template, including the necessary widgets and routing logic.

The Studio Flow will include:

- IVR menu and language selection
- Separate routing paths for each supported language
- HTTP Request widgets to communicate with En3
- Send to Flex widgets to route calls to the appropriate Flex workflow
- Voicemail routing, where applicable
- Required Task Attributes for En3 call processing

The Studio Flow will use the following En3 endpoints:

| Studio Configuration | En3 Endpoint (HTTP POST) |
| --- | --- |
| IVR started | `{EN3_API_BASE}/flex/voice/call/ivr_started` |
| IVR timeout / no input | `{EN3_API_BASE}/flex/voice/call/ivr_no_input` |
| Voicemail routing | `{EN3_API_BASE}/taskrouter/routing/call/incoming` |

### Information Required from The Customer

The Customer only needs to provide the business requirements required to configure the IVR:

- Supported languages
- IVR menu/options
- IVR prompt text or audio assets, if applicable
- Business hours and out-of-hours behavior, if applicable

---

## 6. Voicemail Configuration

The En3 integration requires a dedicated **Twilio Serverless Function** for handling voicemail.

### Required from The Customer

The Customer needs to provide the following within the Flex/Twilio account:

| Requirement | Details |
| --- | --- |
| **Voicemail TaskQueue** | A TaskQueue named exactly `Voicemail` in the Flex TaskRouter Workspace |
| **Serverless Function Deployment Access** | Access/permissions for En3 to deploy the voicemail Function in the the customer’s Twilio account. If the customer does not allow external deployment access, En3 can provide the Function source code and required assets for the customer to deploy via Twilio CLI or the Twilio Console. |

### En3 Responsibility

Nexentria will provide and configure the voicemail Function. The Function will:

- Play the voicemail greeting.
- Record the caller's voicemail.
- Enable voicemail transcription.
- Send recording and transcription callbacks to the En3 application.
- Handle completion of the voicemail recording.

The voicemail Function will be exposed through a `/voicemail` endpoint and integrated with the En3 Studio/Flex routing flow.

### Required Configuration

The `Voicemail`** TaskQueue must exist in the Flex TaskRouter Workspace** so that voicemail calls can be routed and processed by the En3 integration.

---

## En3 and Twilio Flex Integration: Dependency Tree

## Purpose

The access and capability mapping lists each requested item individually. This document shows how those items depend on one another.

Six items are foundational. Each one carries a chain of capabilities beneath it, and if that item is not provided, everything below it is lost regardless of what else is supplied. The remaining items are independent: each removes one capability and affects nothing else.

## 1. Foundational Dependencies

### A. Phone numbers pointed at the Studio Flow and registered in En3

En3 identifies which project a call belongs to from the dialed number. This happens before any other processing, on every call, inbound and outbound.

```
Phone numbers (routed to the Studio Flow, mapped to a project in En3)
│
└── The call enters the integration
    ├── Call record created in En3
    ├── Call task created in En3
    ├── MI inquiry creation
    ├── Call recordings and voicemail
    ├── Screen pop and click-to-dial
    └── All dashboards and reporting
```

**If not provided:** the call is discarded by En3 before any processing takes place. Nothing else in this document can compensate. This is the first dependency in the chain.

---

### B. Studio Flow deployed in the Customer’s Twilio account

```
Studio Flow deployed
│
├── IVR menu and language selection
│   └── Language recorded against the call
│       └── Calls-per-language dashboard
│
├── Call registered at IVR entry (ivr_started)
│   └── Callers who hang up during the menu are recorded
│
├── No-input detection (ivr_no_input)
│   └── Callers who give no input are recorded as abandoned
│
├── Caller-elected voicemail branch
│   └── Voicemail recorded when the caller chooses it from the menu
│
└── Send to Flex widget, carrying the required task attributes
    └── TaskRouter Task created → continues at C
```

**If not provided:** there is no IVR, no language selection, and no route from the phone number into Flex. The call has nowhere to go.

---

### C. Workflow SID and Voice Task Channel SID

These are used by the `Send to Flex` widget to create the TaskRouter Task. No Task means no reservation events and no route to an agent.

```
Workflow SID + Voice Task Channel SID
│
└── TaskRouter Task created
    ├── Call routed to an agent
    ├── All task and reservation events → continues at D
    ├── Agent attribution and MI inquiry
    ├── Caller wait time
    └── Queue-overflow voicemail
```

**If not provided:** the IVR cannot hand the call to Flex. The call is captured at IVR entry and then goes no further.

---

### D. Workspace Event Callback URL pointed at En3

This is the sole feed of call data into En3. Every record, status and metric below originates here.

```
Workspace Event Callback URL → En3
│
├── Call record created and kept current
│   ├── Call task in En3 (open, in progress, completed)
│   ├── Call status classification
│   │   ├── Completed
│   │   ├── Missed
│   │   ├── Abandoned
│   │   └── Voicemail
│   ├── Call history and export
│   └── Volume dashboards (total calls, incoming calls, calls by time of day)
│
├── Agent attribution, resolved from the Flex Worker email
│   ├── MI inquiry created automatically
│   │   └── Screen pop of that inquiry in the Flex panel
│   └── Per-agent dashboards (answered, abandoned, rejected)
│
├── Caller wait time
│   └── Wait-time dashboards (average answered time, longest waits)
│
└── Voicemail queue entry detected
    └── Live caller redirected to voicemail
        └── Voicemail recording and transcription
```

**If not provided:** there is no functioning integration. The call is captured at IVR entry and then remains in that state permanently, with no agent, no inquiry, no status and no reporting.

---

### E. Twilio account credentials

Credentials are not required to receive events, because Twilio sends those to En3. They are required for the three operations En3 performs against Twilio.

```
Twilio Account SID + Auth Token (or API Key + Secret)
│
├── Download recording and voicemail audio
│   ├── Call recordings stored in En3
│   ├── Voicemail recordings stored in En3
│   └── Transcripts attached to the call record
│
├── Redirect a live call
│   └── Queue-overflow voicemail
│       └── Voicemail transcription
│
└── Fetch a TaskRouter Task
    └── Outbound recordings attributed to the correct call
```

**If not provided:** recordings are still created inside Twilio but never reach En3, and no caller can be diverted to voicemail.

### F. Access to deploy the En3 Flex plugin

The plugin runs inside the Flex agent desktop. It applies the recording configuration to each
accepted task and provides the agent-facing features.

```
Flex plugin deployed
│
├── Recording configuration applied to every accepted task
│   └── Call recordings delivered to en3
│       └── Transcripts attached to the call record
│
├── en3 application embedded in the Flex panel
│   └── Screen pop of the matching inquiry
│
└── Click-to-dial
    └── Outbound calls placed from En3, linked to the originating inquiry
```

**If not provided:** conference recordings do not reach En3, because the callback that delivers them  
is applied by the plugin rather than by console configuration. Agents work without en3 context in the  
Flex desktop.

---

## 2. Order of Dependency

For an inbound call, the foundational items apply in this sequence. Each stage requires the one before it.

```
Phone number mapped to a project              (A)

        │

        ▼

Studio Flow runs the IVR                      (B)

        │

        ▼

Workflow and Task Channel create the Task     (C)

        │

        ▼

Events delivered to En3                       (D)

        │

        ├──► Call record, status, agent, inquiry, wait time, dashboards

        │

        ├──► Credentials retrieve audio and divert to voicemail   (E)

        │

        └──► Plugin applies recording and presents the inquiry    (F)
```

A gap at any stage prevents every stage that follows it. Items A, B, C and D must be in place for the integration to function at all. Items E and F each remove a defined set of capabilities without stopping the integration as a whole.


---

## Code Blocks : 


```js
exports.handler = function(context, event, callback) {

  console.log("Voice mail initiated")
    
  let taskSid = event.taskSid;
  let actionUrl = `https://${context.DOMAIN_NAME}/voicemail-complete?taskSid=${taskSid}`;
    
  let twiml = new Twilio.twiml.VoiceResponse();
  twiml.say("Sorry, no one is available to take your call. Please leave a message at the beep. When you're done, press pound or just hang-up.");
  twiml.record({
    action: encodeURI(actionUrl),
    recordingStatusCallback: 'https://tzzk93vyea.execute-api.eu-central-1.amazonaws.com/dev/flex/voice/recording/callback',
    recordingStatusCallbackEvent: 'completed',
    finishOnKey: '#',
    playBeep: true,
    transcribe: true,
    transcribeCallback: 'https://tzzk93vyea.execute-api.eu-central-1.amazonaws.com/dev/flex/voice/recording/callback',
  });
  callback(null, twiml);
};
```

```json
{
  "description": "A New Flow",
  "flags": {
    "allow_concurrent_calls": true
  },
  "initial_state": "Trigger",
  "states": [
    {
      "name": "Trigger",
      "properties": {
        "offset": {
          "x": -118,
          "y": 25
        }
      },
      "transitions": [
        {
          "event": "incomingMessage"
        },
        {
          "event": "incomingCall",
          "next": "create_call"
        },
        {
          "event": "incomingConversationMessage"
        },
        {
          "event": "incomingRequest"
        },
        {
          "event": "incomingParent"
        }
      ],
      "type": "trigger"
    },
    {
      "name": "IVR",
      "properties": {
        "finish_on_key": "#",
        "gather_language": "en",
        "language": "en-US",
        "loop": 1,
        "offset": {
          "x": -114,
          "y": 429
        },
        "say": "Hello. Press 1 for English, 2 for French or 3 to leave a voicemail.",
        "speech_model": "default",
        "speech_timeout": "5",
        "stop_gather": true,
        "timeout": 5
      },
      "transitions": [
        {
          "event": "keypress",
          "next": "Route"
        },
        {
          "event": "speech"
        },
        {
          "event": "timeout",
          "next": "ivr_no_input_update"
        }
      ],
      "type": "gather-input-on-call"
    },
    {
      "name": "Route",
      "properties": {
        "input": "{{widgets.IVR.Digits}}",
        "offset": {
          "x": -191,
          "y": 821
        }
      },
      "transitions": [
        {
          "event": "noMatch"
        },
        {
          "conditions": [
            {
              "arguments": [
                "{{widgets.IVR.Digits}}"
              ],
              "friendly_name": "1",
              "type": "equal_to",
              "value": "1"
            }
          ],
          "event": "match",
          "next": "English"
        },
        {
          "conditions": [
            {
              "arguments": [
                "{{widgets.IVR.Digits}}"
              ],
              "friendly_name": "2",
              "type": "equal_to",
              "value": "2"
            }
          ],
          "event": "match",
          "next": "French"
        },
        {
          "conditions": [
            {
              "arguments": [
                "{{widgets.IVR.Digits}}"
              ],
              "friendly_name": "3",
              "type": "equal_to",
              "value": "3"
            }
          ],
          "event": "match",
          "next": "CreateCall"
        }
      ],
      "type": "split-based-on"
    },
    {
      "name": "English",
      "properties": {
        "attributes": "{\n  \"language\": \"english\"\n}",
        "channel": "TC99799f85ae7b4eb56bf6aac7c11b44ac",
        "offset": {
          "x": -627,
          "y": 1130
        },
        "priority": "0",
        "timeout": "3600",
        "workflow": "WW398210f8f692acba8718d13bc61155bf"
      },
      "transitions": [
        {
          "event": "callComplete"
        },
        {
          "event": "failedToEnqueue"
        },
        {
          "event": "callFailure"
        }
      ],
      "type": "send-to-flex"
    },
    {
      "name": "French",
      "properties": {
        "attributes": "{\n  \"language\": \"french\"\n}",
        "channel": "TC99799f85ae7b4eb56bf6aac7c11b44ac",
        "offset": {
          "x": -155,
          "y": 1532
        },
        "priority": "0",
        "timeout": "3600",
        "workflow": "WW398210f8f692acba8718d13bc61155bf"
      },
      "transitions": [
        {
          "event": "callComplete"
        },
        {
          "event": "failedToEnqueue"
        },
        {
          "event": "callFailure"
        }
      ],
      "type": "send-to-flex"
    },
    {
      "name": "CreateCall",
      "properties": {
        "add_twilio_auth": false,
        "body": "&CallSid={{trigger.call.CallSid}}&Caller={{trigger.call.From}}&Called={{trigger.call.To}}&flex=true&ivf_digit_pressed=3",
        "content_type": "application/x-www-form-urlencoded;charset=utf-8",
        "method": "POST",
        "offset": {
          "x": 324,
          "y": 1112
        },
        "url": "https://tzzk93vyea.execute-api.eu-central-1.amazonaws.com/dev/taskrouter/routing/call/incoming"
      },
      "transitions": [
        {
          "event": "success",
          "next": "Say"
        },
        {
          "event": "failed"
        }
      ],
      "type": "make-http-request"
    },
    {
      "name": "Voicemail",
      "properties": {
        "max_length": 3600,
        "offset": {
          "x": 341,
          "y": 1586
        },
        "timeout": 5,
        "transcribe": true,
        "transcription_callback_url": "https://tzzk93vyea.execute-api.eu-central-1.amazonaws.com/dev/flex/voice/recording/callback"
      },
      "transitions": [
        {
          "event": "recordingComplete"
        },
        {
          "event": "noAudio"
        },
        {
          "event": "hangup"
        }
      ],
      "type": "record-voicemail"
    },
    {
      "name": "Say",
      "properties": {
        "loop": 1,
        "offset": {
          "x": 330,
          "y": 1377
        },
        "say": "Please leave a message after the tone."
      },
      "transitions": [
        {
          "event": "audioComplete",
          "next": "Voicemail"
        }
      ],
      "type": "say-play"
    },
    {
      "name": "create_call",
      "properties": {
        "add_twilio_auth": false,
        "body": "{\"CallSid\": \"{{trigger.call.CallSid}}\", \"From\": \"{{trigger.call.From}}\", \"To\": \"{{trigger.call.To}}\"}",
        "content_type": "application/x-www-form-urlencoded;charset=utf-8",
        "method": "POST",
        "offset": {
          "x": -787,
          "y": 414
        },
        "url": "https://tzzk93vyea.execute-api.eu-central-1.amazonaws.com/dev/flex/voice/call/ivr_started"
      },
      "transitions": [
        {
          "event": "success",
          "next": "IVR"
        },
        {
          "event": "failed"
        }
      ],
      "type": "make-http-request"
    },
    {
      "name": "ivr_no_input_update",
      "properties": {
        "add_twilio_auth": false,
        "body": "{\n  \"CallSid\": \"{{trigger.call.CallSid}}\"\n}",
        "content_type": "application/x-www-form-urlencoded;charset=utf-8",
        "method": "POST",
        "offset": {
          "x": 433,
          "y": 444
        },
        "url": "https://tzzk93vyea.execute-api.eu-central-1.amazonaws.com/dev/flex/voice/call/ivr_no_input"
      },
      "transitions": [
        {
          "event": "success"
        },
        {
          "event": "failed"
        }
      ],
      "type": "make-http-request"
    }
  ]
}
```

# Access and capability mapping

|  | Access or configuration | Capability enabled |
| --- | --- | --- |
| 1 | **Twilio Account SID and Auth Token**, or API Key and Secret | Authenticates En3 to download recordings and voicemail audio, redirect unanswered callers to voicemail, and attribute outbound recordings. |
| 2 | **TaskRouter Workspace SID** | Allows En3 to fetch a Task and resolve an outbound recording to the customer call leg. |
| 3 | **Workspace Event Callback URL ** | Supplies call data records, agent attribution, call status, wait time, MI inquiries and dashboard metrics. |
| 4 | **TaskQueue named exactly **`Voicemail` | Triggers voicemail redirection and classifies the call as voicemail rather than abandoned. |
| 5 | **Workflow SID and Voice Task Channel SID** | Enables the Studio Flow’s “Send to Flex” widgets to create and route a TaskRouter Task. |
| 6 | **Flex Worker **`email`** matching the En3 login email** | Resolves the Flex worker to an En3 user for attribution, MI inquiry creation, screen pop and per-agent reporting. |
| 7 | **Phone numbers with project mapping** | Associates each inbound call & outbound call with the correct En3 project. |
| 8 | **( Studio Flow ) Inbound numbers pointed at the Studio Flow** | Provides the entry point for IVR, language selection and Flex handoff. |
| 9 | **( Studio Flow ) Studio HTTP Request to **`ivr_started` (POST) | Registers calls before the IVR menu, including callers who hang up during the menu, and registers completion callbacks. |
| 10 | **( Studio Flow ) Studio HTTP Request to **`ivr_no_input` (POST) | Marks calls with no IVR input as abandoned. |
| 11 | **( Studio Flow ) ** **Studio voicemail branch to **`taskrouter/routing/call/incoming` (POST) | Records caller-elected voicemail from the IVR. |
| 12 | **Deployment access for the voicemail Serverless Function** | Plays the greeting, records the voicemail, and enables transcription when a queue call times out. |

# Event-level dependencies

| Event | Capability enabled |
| --- | --- |
| `task.created` | Creates the En3 call record and task; captures language. |
| `reservation.accepted` | Attributes the agent, creates the MI inquiry, records wait time and supplies screen-pop identifiers. |
| `reservation.wrapup` | Completes inbound calls and creates outbound call records. |
| `task.canceled` | Distinguishes voicemail from abandonment and sets the missed-call flag. |
| `reservation.timeout` | Records calls offered to an agent but not answered. |
| `reservation.canceled` | Records queue abandonment and the wait time reached. |
| `reservation.rejected` | Records that a specific agent declined the call. |
| `task-queue.entered` | Redirects the live caller to voicemail on entry to the Voicemail queue. |
