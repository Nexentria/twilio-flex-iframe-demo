import { FlexToAngularMessage } from "../types/messages";

/**
 * CRMBridgeService — Sends messages from Flex plugin (parent) to Angular app (child iframe).
 *
 * WHY: The Angular app runs inside the CRM Container iframe. When the iframe URL changes
 * (due to different query params per task), the entire Angular app reloads from scratch.
 * This is slow, loses state, and creates a poor UX.
 *
 * SOLUTION: Mount the iframe ONCE with a static URL (no query params), then send task data
 * via postMessage. The Angular app listens for messages and updates its view without reload.
 *
 * ARCHITECTURE:
 * ┌────────────────────────────────────────────┐
 * │  Flex UI (plugin context)                 │  ← WE ARE HERE
 * │  ┌──────────────────────────────────────┐ │
 * │  │ CRM Container                        │ │
 * │  │  ┌────────────────────────────────┐  │ │
 * │  │  │ <iframe src="static-url">      │  │ │
 * │  │  │   Angular App                  │  │ │  ← TARGET
 * │  │  │   (listens for postMessage)    │  │ │
 * │  │  └────────────────────────────────┘  │ │
 * │  └──────────────────────────────────────┘ │
 * └────────────────────────────────────────────┘
 */
class CRMBridgeService {
  /**
   * Send typed message to Angular app running in CRM Container iframe.
   * Looks up the iframe fresh each call — storing a cross-origin Window
   * reference causes SecurityError because Flex's runtime tries to serialize it.
   */
  send(message: FlexToAngularMessage): void {
    const iframe = document.querySelector(
      'iframe[title="CRMContainer"]',
    ) as HTMLIFrameElement | null;

    if (!iframe?.contentWindow) {
      console.warn(
        "[CRMBridge] CRM iframe not found, message dropped:",
        message.type,
      );
      return;
    }

    try {
      iframe.contentWindow.postMessage(message, "*");
      console.log("[CRMBridge] Sent to Angular:", message);
    } catch (error) {
      console.error("[CRMBridge] Failed to send:", error);
    }
  }
}

// Export as singleton — all parts of the plugin share one instance
export const crmBridge = new CRMBridgeService();
