import type { Order, OrderHeader } from "../shared/schema";

// PayPal API Base URLs
// Use live PayPal API (production) - set to false for sandbox testing
const USE_LIVE_PAYPAL = true;
const PAYPAL_API_BASE = USE_LIVE_PAYPAL
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalInvoiceItem {
  name: string;
  description?: string;
  quantity: string;
  unit_amount: {
    currency_code: string;
    value: string;
  };
  tax?: {
    name: string;
    percent: string;
  };
}

interface PayPalInvoice {
  id: string;
  status: string;
  detail: {
    invoice_number: string;
    currency_code: string;
  };
  amount?: {
    value: string;
  };
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

// Cache access token
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured. Please add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  }

  // Trim whitespace from credentials (common issue)
  const trimmedClientId = clientId.trim();
  const trimmedSecret = clientSecret.trim();
  
  // Debug info (without exposing actual values)
  const environment = USE_LIVE_PAYPAL ? "production (LIVE)" : "sandbox";
  console.log(`[PayPal SDK] Attempting to get access token for ${environment} environment`);
  console.log(`[PayPal SDK] Client ID length: ${trimmedClientId.length} characters`);
  console.log(`[PayPal SDK] Client ID starts with: ${trimmedClientId.substring(0, 4)}...`);
  console.log(`[PayPal SDK] Secret length: ${trimmedSecret.length} characters`);
  console.log(`[PayPal SDK] API URL: ${PAYPAL_API_BASE}/v1/oauth2/token`);

  const auth = Buffer.from(`${trimmedClientId}:${trimmedSecret}`).toString("base64");
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    const environment = USE_LIVE_PAYPAL ? "production (LIVE)" : "sandbox";
    throw new Error(
      `Failed to get PayPal access token from ${environment} environment: ${error}\n\n` +
      `Make sure your PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are for PayPal's ${environment} environment.\n` +
      `${!USE_LIVE_PAYPAL ? "Get sandbox credentials from: https://developer.paypal.com/dashboard/" : ""}`
    );
  }

  const data: PayPalAccessToken = await response.json();
  
  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

export async function createPayPalInvoice(order: Order | OrderHeader, items: PayPalInvoiceItem[]): Promise<PayPalInvoice> {
  const token = await getPayPalAccessToken();
  
  // Prepare invoice data
  const invoiceData = {
    detail: {
      invoice_number: order.orderNumber || `ORD-${order.id.slice(0, 8).toUpperCase()}`,
      invoice_date: new Date().toISOString().split('T')[0],
      currency_code: "USD",
      note: order.description || "Thank you for your order from CustomPictureFrames.com!",
      payment_term: {
        term_type: "DUE_ON_RECEIPT",
      },
    },
    invoicer: {
      name: {
        given_name: "CustomPictureFrames.com",
      },
      email_address: "orders@custompictureframes.com",
      phones: [{
        country_code: "001",
        national_number: "8009168770",
      }],
      address: {
        address_line_1: "6 Shirley Ave",
        admin_area_2: "Somerset",
        admin_area_1: "NJ",
        postal_code: "08873",
        country_code: "US",
      },
    },
    primary_recipients: [{
      billing_info: {
        name: {
          given_name: order.customerName || "Customer",
        },
        email_address: order.email || "",
        phones: order.phone ? [{
          country_code: "001",
          national_number: order.phone.replace(/\D/g, ''),
        }] : undefined,
        address: order.address1 ? {
          address_line_1: order.address1,
          address_line_2: order.address2 || undefined,
          admin_area_2: order.cityStateZip?.split(',')[0]?.trim() || "",
          admin_area_1: order.cityStateZip?.split(',')[1]?.trim().split(' ')[0] || "",
          postal_code: order.cityStateZip?.split(' ').pop() || "",
          country_code: "US",
        } : undefined,
      },
    }],
    items,
    configuration: {
      allow_tip: false,
      allow_partial_payment: false,
      tax_calculated_after_discount: true,
      tax_inclusive: false,
    },
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(invoiceData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal invoice: ${error}`);
  }

  const result = await response.json();
  console.log('[PayPal SDK] Invoice creation response:', JSON.stringify(result, null, 2));
  return result;
}

export async function sendPayPalInvoice(invoiceId: string): Promise<void> {
  console.log(`[PayPal SDK] Getting access token...`);
  const token = await getPayPalAccessToken();
  console.log(`[PayPal SDK] Access token obtained successfully`);

  const endpoint = `${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}/send`;
  console.log(`[PayPal SDK] Sending invoice to: ${endpoint}`);
  
  const requestBody = {
    send_to_invoicer: true,
    send_to_recipient: true,
  };
  console.log(`[PayPal SDK] Request body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`[PayPal SDK] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const error = await response.text();
    console.error(`[PayPal SDK] Error response body:`, error);
    throw new Error(`Failed to send PayPal invoice: ${error}`);
  }
  
  console.log(`[PayPal SDK] Invoice sent successfully`);
}

export async function getPayPalInvoice(invoiceId: string): Promise<PayPalInvoice> {
  const token = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal invoice: ${error}`);
  }

  return await response.json();
}

export async function cancelPayPalInvoice(invoiceId: string, reason: string = "Order cancelled"): Promise<void> {
  const token = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/invoicing/invoices/${invoiceId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject: "Invoice Cancelled",
      note: reason,
      send_to_invoicer: true,
      send_to_recipient: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to cancel PayPal invoice: ${error}`);
  }
}

export async function verifyWebhookSignature(
  webhookId: string,
  headers: Record<string, string>,
  body: any
): Promise<boolean> {
  const token = await getPayPalAccessToken();

  const verificationData = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: body,
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(verificationData),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`PayPal webhook verification failed: ${error}`);
    return false;
  }

  const result = await response.json();
  return result.verification_status === "SUCCESS";
}
