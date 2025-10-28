import type { Order, OrderHeader } from "../shared/schema";

// Klaviyo API v2023-12-15
const KLAVIYO_API_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-10-15";

interface KlaviyoProfile {
  type: "profile";
  attributes: {
    email?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    properties?: Record<string, any>;
  };
}

interface KlaviyoListRelationship {
  data: Array<{
    type: "profile";
    id: string;
  }>;
}

export async function addCustomerToKlaviyo(order: Order | OrderHeader): Promise<void> {
  const apiKey = process.env.KLAVIYO_API_KEY;
  const listId = process.env.KLAVIYO_LIST_ID;

  if (!apiKey || !listId) {
    console.log("[Klaviyo] Skipping - API key or List ID not configured");
    return;
  }

  // Extract customer data from order
  const email = order.customerEmail;
  const phone = order.customerPhone;
  const name = order.customerName;

  // Klaviyo requires at least email or phone
  if (!email && !phone) {
    console.log("[Klaviyo] Skipping - No email or phone provided");
    return;
  }

  try {
    // Split name into first/last
    const nameParts = name?.split(" ") || [];
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Create or update profile
    const profileData: KlaviyoProfile = {
      type: "profile",
      attributes: {
        email: email || undefined,
        phone_number: phone ? formatPhoneForKlaviyo(phone) : undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        properties: {
          last_order_number: order.orderNumber,
          last_order_total: order.total,
          last_order_date: new Date().toISOString(),
        },
      },
    };

    // Create or update profile
    const profileResponse = await fetch(`${KLAVIYO_API_BASE}/profiles/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${apiKey}`,
        "revision": KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: profileData }),
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      throw new Error(`Failed to create Klaviyo profile: ${error}`);
    }

    const profile = await profileResponse.json();
    const profileId = profile.data.id;

    console.log(`[Klaviyo] Created/updated profile ${profileId} for ${email || phone}`);

    // Add profile to list
    const listRelationship: KlaviyoListRelationship = {
      data: [
        {
          type: "profile",
          id: profileId,
        },
      ],
    };

    const listResponse = await fetch(`${KLAVIYO_API_BASE}/lists/${listId}/relationships/profiles/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${apiKey}`,
        "revision": KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(listRelationship),
    });

    if (!listResponse.ok) {
      const error = await listResponse.text();
      // Don't throw error if profile already in list
      if (!error.includes("already exists")) {
        throw new Error(`Failed to add profile to Klaviyo list: ${error}`);
      }
    }

    console.log(`[Klaviyo] Added profile ${profileId} to list ${listId}`);
  } catch (error: any) {
    console.error("[Klaviyo] Error syncing customer:", error.message);
    // Don't throw - we don't want Klaviyo failures to break order creation
  }
}

export async function sendGoogleReviewRequestViaSMS(phone: string, customerName: string, googleReviewUrl: string): Promise<void> {
  const apiKey = process.env.KLAVIYO_API_KEY;

  if (!apiKey) {
    throw new Error("Klaviyo API key not configured");
  }

  try {
    // Create SMS message
    const message = `Hi ${customerName}! Thanks for your order at CustomPictureFrames.com! We'd love your feedback. Please leave us a review: ${googleReviewUrl}`;

    // Send SMS via Klaviyo
    const response = await fetch(`${KLAVIYO_API_BASE}/campaigns/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${apiKey}`,
        "revision": KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "campaign",
          attributes: {
            name: `Google Review Request - ${new Date().toISOString()}`,
            channel: "sms",
            audiences: {
              included: [phone],
            },
            messages: [
              {
                channel: "sms",
                content: {
                  body: message,
                },
              },
            ],
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send SMS via Klaviyo: ${error}`);
    }

    console.log(`[Klaviyo] Sent Google review SMS to ${phone}`);
  } catch (error: any) {
    console.error("[Klaviyo] Error sending SMS:", error.message);
    throw error;
  }
}

// Helper to format phone number for Klaviyo (E.164 format)
function formatPhoneForKlaviyo(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Add +1 if not present (assuming US numbers)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  // Return as-is if already formatted or unknown format
  return phone.startsWith("+") ? phone : `+${digits}`;
}
