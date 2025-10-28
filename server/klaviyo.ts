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
  const email = order.email;
  const phone = order.phone;
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

    // Subscribe to marketing based on customer's consent
    const smsConsent = (order as any).smsConsent;
    
    if (smsConsent && phone) {
      // Customer consented to SMS - subscribe to both SMS and Email
      console.log(`[Klaviyo] Customer consented to SMS, subscribing to SMS and Email marketing...`);
      try {
        await subscribeToMarketingChannels(phone, order.customerName || '', email, true, true);
      } catch (error: any) {
        console.error("[Klaviyo] Error subscribing to marketing:", error.message);
      }
    } else if (email) {
      // No SMS consent, but we have email - subscribe to Email only
      console.log(`[Klaviyo] Subscribing to Email marketing only...`);
      try {
        await subscribeToMarketingChannels(phone || '', order.customerName || '', email, false, true);
      } catch (error: any) {
        console.error("[Klaviyo] Error subscribing to email:", error.message);
      }
    }
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
    // Format phone number to E.164 format for Klaviyo
    const formattedPhone = formatPhoneForKlaviyo(phone);
    
    // Step 1: Create or update profile with phone number
    const profileResponse = await fetch(`${KLAVIYO_API_BASE}/profiles/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${apiKey}`,
        "revision": KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            phone_number: formattedPhone,
            first_name: customerName.split(' ')[0],
            last_name: customerName.split(' ').slice(1).join(' ') || '',
            properties: {
              review_url: googleReviewUrl,
            },
          },
        },
      }),
    });

    let profileId: string;
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      profileId = profileData.data.id;
    } else {
      // Profile might already exist, try to find it
      const searchResponse = await fetch(
        `${KLAVIYO_API_BASE}/profiles/?filter=equals(phone_number,"${formattedPhone}")`,
        {
          headers: {
            "Authorization": `Klaviyo-API-Key ${apiKey}`,
            "revision": KLAVIYO_REVISION,
          },
        }
      );
      
      if (!searchResponse.ok) {
        throw new Error("Failed to create or find profile");
      }
      
      const searchData = await searchResponse.json();
      if (searchData.data && searchData.data.length > 0) {
        profileId = searchData.data[0].id;
      } else {
        throw new Error("Failed to create profile");
      }
    }

    // Step 2: Create a custom event to trigger SMS flow
    const eventResponse = await fetch(`${KLAVIYO_API_BASE}/events/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${apiKey}`,
        "revision": KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            profile: {
              data: {
                type: "profile",
                id: profileId,
              },
            },
            metric: {
              data: {
                type: "metric",
                attributes: {
                  name: "Google Review Request",
                },
              },
            },
            properties: {
              customer_name: customerName,
              review_url: googleReviewUrl,
              phone_number: formattedPhone,
            },
            time: new Date().toISOString(),
          },
        },
      }),
    });

    if (!eventResponse.ok) {
      const error = await eventResponse.text();
      throw new Error(`Failed to create Klaviyo event: ${error}`);
    }

    console.log(`[Klaviyo] Created "Google Review Request" event for profile ${profileId} (${formattedPhone})`);
    console.log('[Klaviyo] Note: To send SMS automatically, create a Flow in Klaviyo that triggers on "Google Review Request" events');
  } catch (error: any) {
    console.error("[Klaviyo] Error sending SMS:", error.message);
    throw error;
  }
}

// Subscribe user to SMS and/or Email marketing in Klaviyo
async function subscribeToMarketingChannels(
  phone: string,
  customerName: string,
  email: string | undefined,
  subscribeSMS: boolean,
  subscribeEmail: boolean
): Promise<void> {
  const apiKey = process.env.KLAVIYO_API_KEY;
  const listId = process.env.KLAVIYO_LIST_ID;

  if (!apiKey || !listId) {
    console.log("[Klaviyo] Skipping subscription - API key or List ID not configured");
    return;
  }

  // Need at least email or phone to subscribe
  if (!email && !phone) {
    console.log("[Klaviyo] Skipping subscription - No email or phone provided");
    return;
  }

  try {
    // Build subscription object based on what we're subscribing to
    const subscriptions: any = {};
    
    if (subscribeSMS && phone) {
      subscriptions.sms = {
        marketing: {
          consent: "SUBSCRIBED",
        },
      };
    }
    
    if (subscribeEmail && email) {
      subscriptions.email = {
        marketing: {
          consent: "SUBSCRIBED",
        },
      };
    }

    // Build profile attributes for subscription API
    // NOTE: The subscription API only accepts email, phone_number, and subscriptions
    // It does NOT accept first_name or last_name
    const profileAttributes: any = {
      subscriptions,
    };
    
    // Add email if provided
    if (email) {
      profileAttributes.email = email;
    }
    
    // Add phone if provided (and format it)
    if (phone) {
      profileAttributes.phone_number = formatPhoneForKlaviyo(phone);
    }

    // Subscribe profile using subscription API
    const subscriptionPayload = {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          profiles: {
            data: [
              {
                type: "profile",
                attributes: profileAttributes,
              },
            ],
          },
        },
        relationships: {
          list: {
            data: {
              type: "list",
              id: listId,
            },
          },
        },
      },
    };

    const channels = [];
    if (subscribeSMS) channels.push('SMS');
    if (subscribeEmail) channels.push('Email');
    
    console.log(`[Klaviyo] Subscribing ${email || phone} to ${channels.join(' and ')} marketing...`);
    console.log(`[Klaviyo] Payload:`, JSON.stringify(subscriptionPayload, null, 2));

    const subscriptionResponse = await fetch(`${KLAVIYO_API_BASE}/profile-subscription-bulk-create-jobs/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${apiKey}`,
        "revision": KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionPayload),
    });

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.text();
      console.error(`[Klaviyo] Failed to subscribe: ${error}`);
      throw new Error(`Klaviyo subscription failed: ${error}`);
    } else {
      // Klaviyo subscription API returns 202 Accepted
      // Try to parse JSON if present, otherwise just log success
      const contentType = subscriptionResponse.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          const result = await subscriptionResponse.json();
          console.log(`[Klaviyo] Successfully subscribed to ${channels.join(' and ')} marketing`);
          console.log(`[Klaviyo] Job ID: ${result.data?.id || 'unknown'}`);
        } catch (e) {
          // Empty response is OK for async jobs
          console.log(`[Klaviyo] Successfully submitted subscription job for ${channels.join(' and ')} marketing`);
        }
      } else {
        // No JSON body (202 Accepted)
        console.log(`[Klaviyo] Successfully submitted subscription job for ${channels.join(' and ')} marketing`);
      }
    }
  } catch (error: any) {
    console.error("[Klaviyo] Error subscribing:", error.message);
    throw error;
  }
}

// Legacy function name for backwards compatibility
export async function subscribeToKlaviyoSMS(phone: string, customerName: string, email?: string): Promise<void> {
  return subscribeToMarketingChannels(phone, customerName, email, true, !!email);
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
