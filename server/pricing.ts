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

// Calculate optimal stacker frame combination for desired shadow depth
function calculateStackerFrames(
  desiredDepth: number,
  width: number,
  height: number,
  matBorderAll: number,
  matBorderLeft: number,
  matBorderRight: number,
  matBorderTop: number,
  matBorderBottom: number,
  config: any
): { layers: { sku: string; depth: number; quantity: number; cost: number }[]; totalCost: number; assemblyCharge: number } {
  if (desiredDepth <= 0) {
    return { layers: [], totalCost: 0, assemblyCharge: 0 };
  }

  // Calculate frame outer dimensions (including mat borders)
  const frameWidth = width + (2 * matBorderAll) + matBorderLeft + matBorderRight;
  const frameHeight = height + (2 * matBorderAll) + matBorderTop + matBorderBottom;
  
  // Calculate perimeter in feet
  const perimeterInches = 2 * (frameWidth + frameHeight);
  const perimeterFeet = perimeterInches / 12;

  // Sort stacker frames by depth (descending) for greedy algorithm
  const stackerFrames = [...config.stackerFrames].sort((a, b) => b.depth - a.depth);
  
  let remainingDepth = desiredDepth;
  const layers: { sku: string; depth: number; quantity: number; cost: number }[] = [];

  // Greedy algorithm: use largest depth first
  for (const frame of stackerFrames) {
    if (remainingDepth <= 0) break;
    
    const quantity = Math.floor(remainingDepth / frame.depth);
    if (quantity > 0) {
      const layerCost = perimeterFeet * frame.pricePerFt * quantity;
      layers.push({
        sku: frame.sku,
        depth: frame.depth,
        quantity,
        cost: layerCost,
      });
      remainingDepth -= quantity * frame.depth;
    }
  }

  // Calculate total frame cost
  const frameCost = layers.reduce((sum, layer) => sum + layer.cost, 0);
  const assemblyCharge = config.stackerAssemblyCharge;
  const totalCost = frameCost + assemblyCharge;

  return { layers, totalCost, assemblyCharge };
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
  
  const config = pricingConfigStorage.getConfig();
  
  // Check if this is a stacker frame order
  let frameCost = 0;
  let stackerFrameData = null;
  
  if (order.stackerFrame && order.shadowDepth) {
    // Calculate stacker frame pricing
    const desiredDepth = parseFraction(order.shadowDepth);
    stackerFrameData = calculateStackerFrames(
      desiredDepth,
      width,
      height,
      matBorderAll,
      matBorderLeft,
      matBorderRight,
      matBorderTop,
      matBorderBottom,
      config
    );
    frameCost = stackerFrameData.totalCost;
  } else {
    // Regular frame pricing
    const mouldingData = order.frameSku ? getMoulding(order.frameSku) : null;
    const mouldingWidth = mouldingData?.width || 2;
    const joinCost = mouldingData?.joinCost || 0;
    
    // Calculate Join Feet
    let joinFt: number;
    if (order.chopOnly) {
      joinFt = config.chopOnlyJoinFt;
    } else {
      joinFt = Math.max(4, Math.ceil((unitedInchesX2 + 8 + (mouldingWidth * 4)) / 12));
    }
    
    frameCost = joinCost * joinFt;
  }
  
  // Determine if this is a standalone component order (no frame)
  const isStandaloneOrder = !order.frameSku || order.frameSku.trim() === "" || order.frameSku === "None";
  // Standalone component markup multiplier (3x makes components more expensive when ordered alone)
  const standaloneMultiplier = isStandaloneOrder ? 3.0 : 1.0;
  
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
  // Use stacker markup for stacker frames, otherwise use regular markup
  const markup = order.stackerFrame ? config.stackerMarkup : config.markup;
  const itemTotal = (frameCost + addOnCosts) * markup * quantity;
  
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
      frameCost: (frameCost * markup * quantity).toFixed(2),
      mat1Cost: (mat1CostBase * markup * quantity).toFixed(2),
      mat2Cost: (mat2CostBase * markup * quantity).toFixed(2),
      mat3Cost: (mat3CostBase * markup * quantity).toFixed(2),
      acrylicCost: (acrylicCostBase * markup * quantity).toFixed(2),
      backingCost: (backingCostBase * markup * quantity).toFixed(2),
      printPaperCost: (printPaperCostBase * markup * quantity).toFixed(2),
      dryMountCost: (dryMountCostBase * markup * quantity).toFixed(2),
      printCanvasCost: (printCanvasCostBase * markup * quantity).toFixed(2),
      engravedPlaqueCost: (engravedPlaqueCostBase * markup * quantity).toFixed(2),
      ledsCost: (ledsCostBase * markup * quantity).toFixed(2),
      shadowboxFittingCost: (shadowboxFittingCostBase * markup * quantity).toFixed(2),
      additionalLaborCost: (additionalLaborCostBase * markup * quantity).toFixed(2),
      extraMatOpeningsCost: (extraMatOpeningsCostBase * markup * quantity).toFixed(2),
    },
  };
}
