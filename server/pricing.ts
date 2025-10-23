import { type InsertOrder } from "@shared/schema";

interface PricingResult {
  itemTotal: string;
  shipping: string;
  salesTax: string;
  total: string;
  balance: string;
}

export function calculatePricing(order: InsertOrder): PricingResult {
  const width = order.width;
  const height = order.height;
  const quantity = order.quantity;
  const discountPercent = order.discountPercent || 0;
  const cityStateZip = order.cityStateZip || "";

  // Calculate item total based on frame size (perimeter * $0.50 per inch)
  const perimeter = (width + height) * 2;
  let basePrice = perimeter * 0.5;

  // Add material costs
  if (order.acrylicType === "Museum Quality") basePrice += 25;
  if (order.acrylicType === "Non-Glare") basePrice += 20;
  
  if (order.backingType === "Acid Free") basePrice += 10;
  if (order.backingType === "Black Foam") basePrice += 5;
  
  // Add option costs
  if (order.printPaper) basePrice += 15;
  if (order.dryMount) basePrice += 20;
  if (order.printCanvas) basePrice += 35;
  if (order.engravedPlaque) basePrice += 30;
  if (order.leds) basePrice += 45;
  if (order.shadowboxFitting) basePrice += 40;
  if (order.additionalLabor) basePrice += 50;

  // Add mat costs
  if (order.mat1Sku) basePrice += 15;
  if (order.mat2Sku) basePrice += 15;
  if (order.mat3Sku) basePrice += 15;
  basePrice += (order.extraMatOpenings || 0) * 10;

  const itemTotal = basePrice * quantity;

  // Calculate shipping (flat rate, higher for HI/AK/PR)
  const isRemoteDestination = /\b(HI|AK|PR|Hawaii|Alaska|Puerto Rico)\b/i.test(cityStateZip);
  const shipping = isRemoteDestination ? 250 : 25;

  // Calculate sales tax (7% if in NJ)
  const isTaxable = /\bNJ\b/i.test(cityStateZip);
  const salesTax = isTaxable ? itemTotal * 0.07 : 0;

  // Calculate total with discount
  const subtotal = itemTotal + shipping + salesTax;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;

  const deposit = order.deposit ? parseFloat(order.deposit.toString()) : 0;
  const balance = total - deposit;

  return {
    itemTotal: itemTotal.toFixed(2),
    shipping: shipping.toFixed(2),
    salesTax: salesTax > 0 ? salesTax.toFixed(2) : "",
    total: total.toFixed(2),
    balance: balance.toFixed(2),
  };
}
