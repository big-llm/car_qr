export type NotificationChannel = "whatsapp" | "sms" | "push";

export interface NotificationAttemptResult {
  channel: NotificationChannel;
  success: boolean;
  providerMessage: string;
}

export const sendNotification = async (
  phoneNumber: string,
  message: string,
  channel: NotificationChannel = "sms"
): Promise<NotificationAttemptResult> => {
  // In a real application, integration with Twilio, WhatsApp Business API (e.g. Meta Graph API),
  // or a local SMS gateway would occur here.
  // For the MVP, we mock the service and log it.
  
  try {
    console.log(`[Notification Service] Sending ${channel} to ${phoneNumber}: "${message}"`);
    // Mocking an async delay for network request
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Simulating a successful request
    return {
      channel,
      success: true,
      providerMessage: "Mock provider accepted message"
    };
  } catch (error) {
    console.error("[Notification Service] Error sending message:", error);
    return {
      channel,
      success: false,
      providerMessage: error instanceof Error ? error.message : "Unknown notification failure"
    };
  }
};
