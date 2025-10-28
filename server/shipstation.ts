/**
 * ShipStation API Integration
 * 
 * This module provides functions to sync orders with ShipStation using their V1 API.
 * API Documentation: https://www.shipstation.com/docs/api/
 */

import type { Order, OrderHeader, OrderItem } from "@shared/schema";

// ShipStation API configuration
const SHIPSTATION_API_URL = "https://ssapi.shipstation.com";

interface ShipStationAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  residential?: boolean;
}

interface ShipStationItem {
  lineItemKey?: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  weight?: {
    value: number;
    units: "pounds" | "ounces" | "grams";
  };
}

interface ShipStationOrderRequest {
  orderNumber: string;
  orderKey?: string;
  orderDate: string;
  orderStatus: "awaiting_payment" | "awaiting_shipment" | "shipped" | "on_hold" | "cancelled";
  paymentDate?: string;
  customerEmail?: string;
  billTo?: ShipStationAddress;
  shipTo?: ShipStationAddress;
  items: ShipStationItem[];
  amountPaid?: number;
  taxAmount?: number;
  shippingAmount?: number;
  customerNotes?: string;
  internalNotes?: string;
  requestedShippingService?: string;
  carrierCode?: string;
  serviceCode?: string;
  customField1?: string;
  customField2?: string;
  customField3?: string;
}

interface ShipStationOrderResponse {
  orderId: number;
  orderNumber: string;
  orderKey: string;
  orderDate: string;
  orderStatus: string;
  [key: string]: any;
}

/**
 * Parse address from cityStateZip field (e.g., "Newark, NJ 07102")
 */
function parseAddress(cityStateZip: string | null): { city: string; state: string; postalCode: string } {
  if (!cityStateZip) {
    return { city: "", state: "", postalCode: "" };
  }

  // Try to parse "City, ST ZIP" format
  const match = cityStateZip.match(/^([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (match) {
    return {
      city: match[1].trim(),
      state: match[2].trim().toUpperCase(),
      postalCode: match[3].trim(),
    };
  }

  // Fallback: return as-is
  return { city: cityStateZip, state: "", postalCode: "" };
}

/**
 * Convert single-item order to ShipStation format
 */
function convertSingleOrderToShipStation(order: Order): ShipStationOrderRequest {
  const { city, state, postalCode } = parseAddress(order.cityStateZip);

  // Build shipping address
  const shipTo: ShipStationAddress | undefined = order.customerName
    ? {
        name: order.customerName,
        street1: order.address1 || "",
        street2: order.address2 || undefined,
        city: city || "Unknown",
        state: state || "Unknown",
        postalCode: postalCode || "00000",
        country: "US",
        phone: order.phone || undefined,
        residential: order.deliveryMethod !== "commercial",
      }
    : undefined;

  // Build item description
  let itemDescription = "Custom Picture Frame";
  if (order.frameSku) {
    itemDescription = `Frame ${order.frameSku}`;
  }
  if (order.width && order.height) {
    itemDescription += ` (${order.width}" × ${order.height}")`;
  }
  if (order.description) {
    itemDescription = order.description;
  }

  // Create item entry
  const items: ShipStationItem[] = [
    {
      sku: order.frameSku || undefined,
      name: itemDescription,
      quantity: order.quantity || 1,
      unitPrice: parseFloat(order.itemTotal.toString()),
      taxAmount: order.salesTax ? parseFloat(order.salesTax.toString()) : undefined,
    },
  ];

  // Determine order status based on payment
  let orderStatus: ShipStationOrderRequest["orderStatus"] = "awaiting_shipment";
  const balance = parseFloat(order.balance.toString());
  if (balance > 0) {
    orderStatus = "awaiting_payment";
  }

  return {
    orderNumber: order.id,
    orderKey: order.id,
    orderDate: order.orderDate.toISOString(),
    orderStatus,
    customerEmail: order.email || undefined,
    billTo: shipTo,
    shipTo,
    items,
    amountPaid: parseFloat(order.paidToDate.toString()),
    taxAmount: order.salesTax ? parseFloat(order.salesTax.toString()) : undefined,
    shippingAmount: parseFloat(order.shipping.toString()),
    customerNotes: order.specialRequests || undefined,
    internalNotes: order.description || undefined,
    requestedShippingService: order.deliveryMethod === "pickup" ? "Customer Pickup" : undefined,
  };
}

/**
 * Convert multi-item order to ShipStation format
 */
function convertMultiItemOrderToShipStation(
  header: OrderHeader,
  items: OrderItem[]
): ShipStationOrderRequest {
  const { city, state, postalCode } = parseAddress(header.cityStateZip);

  // Build shipping address
  const shipTo: ShipStationAddress | undefined = header.customerName
    ? {
        name: header.customerName,
        street1: header.address1 || "",
        street2: header.address2 || undefined,
        city: city || "Unknown",
        state: state || "Unknown",
        postalCode: postalCode || "00000",
        country: "US",
        phone: header.phone || undefined,
        residential: header.deliveryMethod !== "commercial",
      }
    : undefined;

  // Build items array
  const shipStationItems: ShipStationItem[] = items.map((item) => {
    let itemDescription = `Item ${item.itemNumber}: Custom Picture Frame`;
    if (item.frameSku) {
      itemDescription = `Item ${item.itemNumber}: Frame ${item.frameSku}`;
    }
    if (item.width && item.height) {
      itemDescription += ` (${item.width}" × ${item.height}")`;
    }

    return {
      lineItemKey: item.id,
      sku: item.frameSku || undefined,
      name: itemDescription,
      quantity: item.quantity || 1,
      unitPrice: parseFloat(item.itemTotal?.toString() || "0"),
    };
  });

  // Determine order status based on payment
  let orderStatus: ShipStationOrderRequest["orderStatus"] = "awaiting_shipment";
  const balance = parseFloat(header.balance.toString());
  if (balance > 0) {
    orderStatus = "awaiting_payment";
  }

  return {
    orderNumber: header.id,
    orderKey: header.id,
    orderDate: header.orderDate.toISOString(),
    orderStatus,
    customerEmail: header.email || undefined,
    billTo: shipTo,
    shipTo,
    items: shipStationItems,
    amountPaid: parseFloat(header.paidToDate.toString()),
    taxAmount: header.salesTax ? parseFloat(header.salesTax.toString()) : undefined,
    shippingAmount: parseFloat(header.shipping.toString()),
    customerNotes: header.specialRequests || undefined,
    internalNotes: header.description || undefined,
    requestedShippingService: header.deliveryMethod === "pickup" ? "Customer Pickup" : undefined,
  };
}

/**
 * Sync single-item order to ShipStation
 */
export async function syncOrderToShipStation(order: Order): Promise<ShipStationOrderResponse> {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("ShipStation API credentials not configured. Please set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.");
  }

  // Convert order to ShipStation format
  const shipStationOrder = convertSingleOrderToShipStation(order);

  // Prepare authentication header
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  // Make API request
  const response = await fetch(`${SHIPSTATION_API_URL}/orders/createorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify(shipStationOrder),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ShipStation API error (${response.status}): ${errorText}`);
  }

  const result: ShipStationOrderResponse = await response.json();
  return result;
}

/**
 * Sync multi-item order to ShipStation
 */
export async function syncMultiItemOrderToShipStation(
  header: OrderHeader,
  items: OrderItem[]
): Promise<ShipStationOrderResponse> {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("ShipStation API credentials not configured. Please set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.");
  }

  // Convert order to ShipStation format
  const shipStationOrder = convertMultiItemOrderToShipStation(header, items);

  // Prepare authentication header
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  // Make API request
  const response = await fetch(`${SHIPSTATION_API_URL}/orders/createorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify(shipStationOrder),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ShipStation API error (${response.status}): ${errorText}`);
  }

  const result: ShipStationOrderResponse = await response.json();
  return result;
}
