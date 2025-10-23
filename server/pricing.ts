import { type InsertOrder } from "@shared/schema";
import { getMoulding, getSupply, loadPricingData } from "./pricing-data";
import { pricingConfigStorage } from "./storage";

interface PricingResult {
  itemTotal: string;
  shipping: string;
  salesTax: string;
  total: string;
  balance: string;
  // Itemized component breakdown
  breakdown: {
    frameCost: string;
    mat1Cost: string;
    mat2Cost: string;
    mat3Cost: string;
    acrylicCost: string;
    backingCost: string;
    printPaperCost: string;
    dryMountCost: string;
    printCanvasCost: string;
    engravedPlaqueCost: string;
    ledsCost: string;
    shadowboxFittingCost: string;
    additionalLaborCost: string;
    extraMatOpeningsCost: string;
  };
}

// Helper function to parse fractions and decimals (e.g., "16 1/2", "16-1/2", "16.5", "1/2")
function parseFraction(input: string | number | null | undefined): number {
  if (!input) return 0;
  if (typeof input === 'number') return input;
  
  const str = input.toString().trim();
  if (str === "") return 0;
  
  // Check for mixed fraction (e.g., "16 1/2" or "16-1/2")
  const mixedMatch = str.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + (numerator / denominator);
  }
  
  // Check for simple fraction (e.g., "1/2")
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    return numerator / denominator;
  }
  
  // Otherwise parse as decimal
  return parseFloat(str) || 0;
}

export function calculatePricing(order: InsertOrder): PricingResult {
  // Load pricing data
  const pricingData = loadPricingData();
  
  // Parse dimensions (support both decimals and fractions)
  const width = parseFraction(order.width);
  const height = parseFraction(order.height);
  const quantity = order.quantity || 1;
  
  // Parse mat borders (support both decimals and fractions)
  const matBorderAll = parseFraction(order.matBorderAll);
  const matBorderLeft = parseFraction(order.matBorderLeft);
  const matBorderRight = parseFraction(order.matBorderRight);
  const matBorderTop = parseFraction(order.matBorderTop);
  const matBorderBottom = parseFraction(order.matBorderBottom);
  const mat1Reveal = parseFraction(order.mat1Reveal);
  const mat2Reveal = parseFraction(order.mat2Reveal);
  
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
  const config = pricingConfigStorage.getConfig();
  let joinFt: number;
  if (order.chopOnly) {
    joinFt = config.chopOnlyJoinFt; // Default 18 feet for chop only
  } else {
    // MAX(4, ROUNDUP(((unitedInchesX2 + 8 + (mouldingWidth * 4)) / 12), 0))
    joinFt = Math.max(4, Math.ceil((unitedInchesX2 + 8 + (mouldingWidth * 4)) / 12));
  }
  
  // Frame Cost = Join Cost * Join Feet
  const frameCost = joinCost * joinFt;
  
  // Determine if this is a standalone component order (no frame)
  const isStandaloneOrder = !order.frameSku || order.frameSku.trim() === "" || order.frameSku === "None";
  // Standalone component markup multiplier (1.65x makes components more expensive when ordered alone)
  const standaloneMultiplier = isStandaloneOrder ? 1.65 : 1.0;
  
  // Track individual component costs for breakdown
  let mat1CostBase = 0;
  let mat2CostBase = 0;
  let mat3CostBase = 0;
  let acrylicCostBase = 0;
  let backingCostBase = 0;
  let printPaperCostBase = 0;
  let dryMountCostBase = 0;
  let printCanvasCostBase = 0;
  let engravedPlaqueCostBase = 0;
  let ledsCostBase = 0;
  let shadowboxFittingCostBase = 0;
  let additionalLaborCostBase = 0;
  let extraMatOpeningsCostBase = 0;
  
  // Calculate add-on costs
  let addOnCosts = 0;
  
  // Acrylic cost (per square inch) - use dynamic config
  const acrylicType = order.acrylicType || 'Standard';
  if (acrylicType !== 'None') {
    const acrylicPrice = config.acrylicPrices.find(p => p.type === acrylicType);
    acrylicCostBase = (acrylicPrice?.pricePerSqIn || 0) * squareInches * standaloneMultiplier;
    addOnCosts += acrylicCostBase;
  }
  
  // Backing cost - use dynamic config
  const backingType = order.backingType || 'White Foam';
  if (backingType !== 'None') {
    const backingPrice = config.backingPrices.find(p => p.type === backingType);
    backingCostBase = (backingPrice?.price || 0) * standaloneMultiplier;
    addOnCosts += backingCostBase;
  }
  
  // Mat costs - apply standalone multiplier
  if (order.mat1Sku) {
    const mat1 = getSupply(order.mat1Sku);
    mat1CostBase = (mat1?.price || 15) * standaloneMultiplier;
    addOnCosts += mat1CostBase;
  }
  if (order.mat2Sku) {
    const mat2 = getSupply(order.mat2Sku);
    mat2CostBase = (mat2?.price || 15) * standaloneMultiplier;
    addOnCosts += mat2CostBase;
  }
  if (order.mat3Sku) {
    const mat3 = getSupply(order.mat3Sku);
    mat3CostBase = (mat3?.price || 15) * standaloneMultiplier;
    addOnCosts += mat3CostBase;
  }
  
  // Extra mat openings
  extraMatOpeningsCostBase = (order.extraMatOpenings || 0) * 2.5;
  addOnCosts += extraMatOpeningsCostBase;
  
  // Print options (per square inch)
  if (order.printPaper) {
    printPaperCostBase = 0.05 * squareInches;
    addOnCosts += printPaperCostBase;
  }
  if (order.dryMount) {
    dryMountCostBase = 0.03 * squareInches;
    addOnCosts += dryMountCostBase;
  }
  if (order.printCanvas) {
    // Rolled canvas is 10% more than paper print ($0.05 × 1.10 = $0.055)
    if (order.printCanvasWrapStyle === "Rolled") {
      printCanvasCostBase = 0.055 * squareInches;
    } else {
      // Gallery and Museum use standard canvas pricing
      printCanvasCostBase = 0.08 * squareInches;
    }
    addOnCosts += printCanvasCostBase;
  }
  
  // Fixed-cost options
  if (order.engravedPlaque) {
    engravedPlaqueCostBase = 30;
    addOnCosts += engravedPlaqueCostBase;
  }
  if (order.leds) {
    ledsCostBase = 45;
    addOnCosts += ledsCostBase;
  }
  if (order.shadowboxFitting) {
    shadowboxFittingCostBase = 17.50;
    addOnCosts += shadowboxFittingCostBase;
  }
  if (order.additionalLabor) {
    additionalLaborCostBase = 17.50;
    addOnCosts += additionalLaborCostBase;
  }
  
  // Calculate Item Total with Markup (use dynamic config)
  // Formula: (Frame Cost + Add-ons) * Markup * Quantity
  const itemTotal = (frameCost + addOnCosts) * config.markup * quantity;
  
  // Calculate Shipping - use dynamic config shipping rates
  let shipping: number;
  
  // Check if customer pickup - no shipping charge
  if (order.deliveryMethod === "pickup") {
    shipping = 0;
  } else if (order.chopOnly) {
    shipping = 29;
  } else {
    // Find appropriate shipping rate based on united inches
    const shippingRate = config.shippingRates
      .filter(r => unitedInches >= r.min && unitedInches <= r.max)
      .shift();
    shipping = shippingRate?.rate || 9;
    
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
  
  // Calculate Total (discount is now a text field, not applied in calculation)
  const total = itemTotal + shipping + salesTax;
  
  // Calculate Balance (deposit is now a text field, parse it)
  const deposit = parseFraction(order.deposit);
  const balance = total - deposit;
  
  return {
    itemTotal: itemTotal.toFixed(2),
    shipping: shipping.toFixed(2),
    salesTax: salesTax > 0 ? salesTax.toFixed(2) : "",
    total: total.toFixed(2),
    balance: balance.toFixed(2),
    breakdown: {
      frameCost: (frameCost * config.markup * quantity).toFixed(2),
      mat1Cost: (mat1CostBase * config.markup * quantity).toFixed(2),
      mat2Cost: (mat2CostBase * config.markup * quantity).toFixed(2),
      mat3Cost: (mat3CostBase * config.markup * quantity).toFixed(2),
      acrylicCost: (acrylicCostBase * config.markup * quantity).toFixed(2),
      backingCost: (backingCostBase * config.markup * quantity).toFixed(2),
      printPaperCost: (printPaperCostBase * config.markup * quantity).toFixed(2),
      dryMountCost: (dryMountCostBase * config.markup * quantity).toFixed(2),
      printCanvasCost: (printCanvasCostBase * config.markup * quantity).toFixed(2),
      engravedPlaqueCost: (engravedPlaqueCostBase * config.markup * quantity).toFixed(2),
      ledsCost: (ledsCostBase * config.markup * quantity).toFixed(2),
      shadowboxFittingCost: (shadowboxFittingCostBase * config.markup * quantity).toFixed(2),
      additionalLaborCost: (additionalLaborCostBase * config.markup * quantity).toFixed(2),
      extraMatOpeningsCost: (extraMatOpeningsCostBase * config.markup * quantity).toFixed(2),
    },
  };
}
