import type { Order, OrderHeader } from "../shared/schema";
import twilio from 'twilio';

// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 * Handles various US phone number formats
 */
function formatPhoneForTwilio(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it's a 10-digit US number, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it starts with 1 and has 11 digits, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // Return as-is if already formatted or unknown format
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/**
 * Send SMS using Twilio
 */
export async function sendSMS(to: string, message: string): Promise<void> {
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    console.log("[Twilio] Skipping - Twilio credentials not configured");
    return;
  }

  try {
    const formattedPhone = formatPhoneForTwilio(to);
    
    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`[Twilio] SMS sent successfully. SID: ${result.sid}`);
  } catch (error: any) {
    console.error("[Twilio] Error sending SMS:", error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Send Google Review request via SMS
 */
export async function sendGoogleReviewRequestViaSMS(
  phone: string,
  customerName: string,
  googleReviewUrl: string
): Promise<void> {
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio credentials not configured");
  }

  const firstName = customerName.split(" ")[0] || customerName;
  
  const message = `Hi ${firstName}! Thank you for choosing CustomPictureFrames.com! We'd love to hear your feedback. Please leave us a review: ${googleReviewUrl}`;

  try {
    await sendSMS(phone, message);
    console.log(`[Twilio] Google review request sent to ${phone}`);
  } catch (error: any) {
    console.error("[Twilio] Failed to send review request:", error.message);
    throw error;
  }
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmationSMS(order: Order | OrderHeader): Promise<void> {
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    console.log("[Twilio] Skipping order confirmation SMS - Twilio not configured");
    return;
  }

  const phone = order.phone;
  if (!phone) {
    console.log("[Twilio] Skipping order confirmation SMS - No phone number provided");
    return;
  }

  const message = `Thank you for your order ${order.orderNumber}! We've received it and will start processing soon. - CustomPictureFrames.com`;

  try {
    await sendSMS(phone, message);
    console.log(`[Twilio] Order confirmation SMS sent for order ${order.orderNumber}`);
  } catch (error: any) {
    console.error("[Twilio] Failed to send order confirmation SMS:", error.message);
    // Don't throw - we don't want SMS failures to break order creation
  }
}

/**
 * Send custom SMS notification
 */
export async function sendCustomSMS(
  phone: string,
  customerName: string,
  message: string
): Promise<void> {
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio credentials not configured");
  }

  try {
    await sendSMS(phone, message);
    console.log(`[Twilio] Custom SMS sent to ${customerName} (${phone})`);
  } catch (error: any) {
    console.error("[Twilio] Failed to send custom SMS:", error.message);
    throw error;
  }
}
