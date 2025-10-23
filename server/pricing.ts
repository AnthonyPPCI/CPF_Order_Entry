import { type InsertOrder } from "@shared/schema";
import { getMoulding, getSupply, loadPricingData } from "./pricing-data";

interface PricingResult {
  itemTotal: string;
  shipping: string;
  salesTax: string;
  total: string;
  balance: string;
}

export function calculatePricing(order: InsertOrder): PricingResult {
  // Load pricing data
  const pricingData = loadPricingData();
  
  // Parse dimensions (they're decimals now to support fractions)
  const width = typeof order.width === 'string' ? parseFloat(order.width) : order.width;
  const height = typeof order.height === 'string' ? parseFloat(order.height) : order.height;
  const quantity = order.quantity || 1;
  const discountPercent = order.discountPercent || 0;
  
  // Parse mat borders
  const matBorderAll = order.matBorderAll ? parseFloat(order.matBorderAll.toString()) : 0;
  const matBorderLeft = order.matBorderLeft ? parseFloat(order.matBorderLeft.toString()) : 0;
  const matBorderRight = order.matBorderRight ? parseFloat(order.matBorderRight.toString()) : 0;
  const matBorderTop = order.matBorderTop ? parseFloat(order.matBorderTop.toString()) : 0;
  const matBorderBottom = order.matBorderBottom ? parseFloat(order.matBorderBottom.toString()) : 0;
  const mat1Reveal = order.mat1Reveal ? parseFloat(order.mat1Reveal.toString()) : 0;
  const mat2Reveal = order.mat2Reveal ? parseFloat(order.mat2Reveal.toString()) : 0;
  
  // Calculate United Inches (Formula from Google Sheets H10)
  // ( Width + 2*MatBorderAll + MatBorderLeft + MatBorderRight )
  // + ( Height + 2*MatBorderAll + MatBorderTop + MatBorderBottom )
  // + Mat1Reveal + Mat2Reveal
  const unitedInches = (
    (width + 2 * matBorderAll + matBorderLeft + matBorderRight)
    + (height + 2 * matBorderAll + matBorderTop + matBorderBottom)
    + mat1Reveal + mat2Reveal
  );
  
  // United Inches x 2
  const unitedInchesX2 = unitedInches * 2;
  
  // Square inches
  const squareInches = (
    width + 2 * matBorderAll + matBorderLeft + matBorderRight + (mat1Reveal + mat2Reveal) / 2
  ) * (
    height + 2 * matBorderAll + matBorderTop + matBorderBottom + (mat1Reveal + mat2Reveal) / 2
  );
  
  // Look up moulding data
  const mouldingData = order.frameSku ? getMoulding(order.frameSku) : null;
  const mouldingWidth = mouldingData?.width || 2; // Default to 2 if not found
  const joinCost = mouldingData?.joinCost || 0;
  
  // Calculate Join Feet (Formula from Google Sheets H14)
  let joinFt: number;
  if (order.chopOnly) {
    joinFt = pricingData.chopOnlyJoinFt; // 18 feet for chop only
  } else {
    // MAX(4, ROUNDUP(((unitedInchesX2 + 8 + (mouldingWidth * 4)) / 12), 0))
    joinFt = Math.max(4, Math.ceil((unitedInchesX2 + 8 + (mouldingWidth * 4)) / 12));
  }
  
  // Frame Cost = Join Cost * Join Feet
  const frameCost = joinCost * joinFt;
  
  // Calculate add-on costs
  let addOnCosts = 0;
  
  // Acrylic cost (per square inch)
  const acrylicPrices: Record<string, number> = {
    'Standard': 0.009,
    'Non-Glare': 0.018,
    'Museum Quality': 0.027,
  };
  const acrylicType = order.acrylicType || 'Standard';
  const acrylicCost = (acrylicPrices[acrylicType] || 0) * squareInches;
  addOnCosts += acrylicCost;
  
  // Backing cost (lookup from supply table)
  const backingPrices: Record<string, number> = {
    'None': 0,
    'White Foam': 2,
    'Black Foam': 2.5,
    'Acid Free': 3,
  };
  const backingType = order.backingType || 'White Foam';
  const backingCost = backingPrices[backingType] || 0;
  addOnCosts += backingCost;
  
  // Mat costs (would need to look up from supply table, using defaults for now)
  if (order.mat1Sku) {
    const mat1 = getSupply(order.mat1Sku);
    addOnCosts += mat1?.price || 15;
  }
  if (order.mat2Sku) {
    const mat2 = getSupply(order.mat2Sku);
    addOnCosts += mat2?.price || 15;
  }
  if (order.mat3Sku) {
    const mat3 = getSupply(order.mat3Sku);
    addOnCosts += mat3?.price || 15;
  }
  
  // Extra mat openings
  addOnCosts += (order.extraMatOpenings || 0) * 2.5;
  
  // Print options (per square inch)
  if (order.printPaper) {
    addOnCosts += 0.05 * squareInches;
  }
  if (order.dryMount) {
    addOnCosts += 0.03 * squareInches;
  }
  if (order.printCanvas) {
    addOnCosts += 0.08 * squareInches;
  }
  
  // Fixed-cost options
  if (order.engravedPlaque) {
    addOnCosts += 30;
  }
  if (order.leds) {
    addOnCosts += 45;
  }
  if (order.shadowboxFitting) {
    addOnCosts += 40;
  }
  if (order.additionalLabor) {
    addOnCosts += 50;
  }
  
  // Calculate Item Total with Markup
  // Formula: (Frame Cost + Add-ons) * Markup * Quantity
  const itemTotal = (frameCost + addOnCosts) * pricingData.markup * quantity;
  
  // Calculate Shipping (Formula from Google Sheets H18)
  // Lookup based on united inches: {1:9, 31:19, 50:29, 75:250}
  let shipping: number;
  if (order.chopOnly) {
    shipping = 29;
  } else {
    if (unitedInches >= 75) {
      shipping = 250;
    } else if (unitedInches >= 50) {
      shipping = 29;
    } else if (unitedInches >= 31) {
      shipping = 19;
    } else {
      shipping = 9;
    }
    
    // Check for remote destination (HI, AK, PR) to add extra $99
    const cityStateZip = order.cityStateZip || "";
    const isRemoteDestination = /\b(HI|AK|PR|Hawaii|Alaska|Puerto Rico)\b/i.test(cityStateZip);
    if (isRemoteDestination && unitedInches < 75) {
      shipping += 99;
    }
  }
  
  // Calculate Sales Tax (7% if in NJ)
  const cityStateZip = order.cityStateZip || "";
  const isTaxable = /\bNJ\b/i.test(cityStateZip);
  const salesTax = isTaxable ? itemTotal * 0.07 : 0;
  
  // Calculate Total with Discount
  // Formula: (ItemTotal + Shipping + SalesTax) * (1 - Discount%)
  const subtotal = itemTotal + shipping + salesTax;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;
  
  // Calculate Balance
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
