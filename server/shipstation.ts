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

interface ShipStationItemOption {
  name: string;
  value: string;
}

interface ShipStationItem {
  lineItemKey?: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  options?: ShipStationItemOption[];
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
 * Build item options array for ShipStation pack slip
 * Lists all components: frame type, acrylic, backing, mats, special features
 */
function buildItemOptions(item: any): ShipStationItemOption[] {
  const options: ShipStationItemOption[] = [];

  // Frame Type (only on Order type)
  if (item.frameType) {
    options.push({ name: "Frame Type", value: item.frameType });
  }

  // Acrylic
  if (item.acrylicType) {
    options.push({ name: "Acrylic", value: item.acrylicType });
  }

  // Backing
  if (item.backingSku) {
    options.push({ name: "Backing", value: item.backingSku });
  }

  // Mat configuration
  if (item.mat1Sku) {
    const matDescription = item.mat2Sku ? "Double Mat" : "Single Mat";
    options.push({ name: "Mat Configuration", value: matDescription });
    
    // Mat colors
    options.push({ name: "Mat 1", value: `Sku: ${item.mat1Sku}` });
    if (item.mat2Sku) {
      options.push({ name: "Mat 2", value: `Sku: ${item.mat2Sku}` });
    }
    
    // Mat borders
    if (item.matBorderAll) {
      options.push({ name: "Mat Border", value: `${item.matBorderAll}"` });
    } else {
      const borders: string[] = [];
      if (item.matBorderLeft) borders.push(`Left: ${item.matBorderLeft}"`);
      if (item.matBorderRight) borders.push(`Right: ${item.matBorderRight}"`);
      if (item.matBorderTop) borders.push(`Top: ${item.matBorderTop}"`);
      if (item.matBorderBottom) borders.push(`Bottom: ${item.matBorderBottom}"`);
      if (borders.length > 0) {
        options.push({ name: "Mat Borders", value: borders.join(", ") });
      }
    }
    
    // Mat reveals (for double mats)
    if (item.mat1Reveal) {
      options.push({ name: "Mat 1 Reveal", value: `${item.mat1Reveal}"` });
    }
    if (item.mat2Reveal) {
      options.push({ name: "Mat 2 Reveal", value: `${item.mat2Reveal}"` });
    }
  }

  // Extra mat openings
  if (item.extraMatOpenings && item.extraMatOpenings > 0) {
    options.push({ name: "Extra Mat Openings", value: item.extraMatOpenings.toString() });
  }

  // Shadow depth (Stacker frames)
  if (item.shadowDepth) {
    options.push({ name: "Shadow Depth", value: `${item.shadowDepth}"` });
  }

  // Topper
  if (item.topperSku) {
    options.push({ name: "Topper", value: item.topperSku });
  }

  // Fabric wrapping (only on Order type)
  if (item.fabricWrapping) {
    options.push({ name: "Fabric Wrapping", value: "Yes" });
  }

  // Conservation mounting (only on Order type)
  if (item.conservationMounting) {
    options.push({ name: "Conservation Mounting", value: "Yes" });
  }

  return options;
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

  // Build SKU in format: F{frameSku}_{width}x{height}
  let sku: string | undefined;
  if (order.frameSku && order.width && order.height) {
    sku = `F${order.frameSku}_${order.width}x${order.height}`;
  } else if (order.frameSku) {
    sku = order.frameSku;
  }

  // Build item name
  let itemName = "Custom Picture Frame";
  if (order.frameSku) {
    itemName = `Frame ${order.frameSku}`;
    if (order.width && order.height) {
      itemName += ` (${order.width}" × ${order.height}")`;
    }
  }
  if (order.description) {
    itemName = order.description;
  }

  // Build item options (components list for pack slip)
  const itemOptions = buildItemOptions(order);

  // Create item entry
  const quantity = order.quantity || 1;
  const items: ShipStationItem[] = [
    {
      sku,
      name: itemName,
      quantity: quantity,
      unitPrice: parseFloat(order.itemTotal.toString()) / quantity,
      taxAmount: order.salesTax ? parseFloat(order.salesTax.toString()) : undefined,
      options: itemOptions.length > 0 ? itemOptions : undefined,
    },
  ];

  // Always send orders to ShipStation as paid and ready to ship
  // ShipStation is for shipping management, not payment tracking
  const orderTotal = parseFloat(order.total.toString());

  return {
    orderNumber: order.orderNumber || order.id,
    orderKey: order.id,
    orderDate: order.orderDate.toISOString(),
    orderStatus: "awaiting_shipment",
    paymentDate: order.orderDate.toISOString(),
    customerEmail: order.email || undefined,
    billTo: shipTo,
    shipTo,
    items,
    amountPaid: orderTotal,
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
    // Build SKU in format: F{frameSku}_{width}x{height}
    let sku: string | undefined;
    if (item.frameSku && item.width && item.height) {
      sku = `F${item.frameSku}_${item.width}x${item.height}`;
    } else if (item.frameSku) {
      sku = item.frameSku;
    }

    // Build item name
    let itemName = `Item ${item.itemNumber}: Custom Picture Frame`;
    if (item.frameSku) {
      itemName = `Item ${item.itemNumber}: Frame ${item.frameSku}`;
      if (item.width && item.height) {
        itemName += ` (${item.width}" × ${item.height}")`;
      }
    }

    // Build item options (components list for pack slip)
    const itemOptions = buildItemOptions(item);

    const quantity = item.quantity || 1;
    const itemTotal = parseFloat(item.itemTotal?.toString() || "0");
    
    return {
      lineItemKey: item.id,
      sku,
      name: itemName,
      quantity: quantity,
      unitPrice: itemTotal / quantity,
      options: itemOptions.length > 0 ? itemOptions : undefined,
    };
  });

  // Always send orders to ShipStation as paid and ready to ship
  // ShipStation is for shipping management, not payment tracking
  const orderTotal = parseFloat(header.total.toString());

  return {
    orderNumber: header.orderNumber || header.id,
    orderKey: header.id,
    orderDate: header.orderDate.toISOString(),
    orderStatus: "awaiting_shipment",
    paymentDate: header.orderDate.toISOString(),
    customerEmail: header.email || undefined,
    billTo: shipTo,
    shipTo,
    items: shipStationItems,
    amountPaid: orderTotal,
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
