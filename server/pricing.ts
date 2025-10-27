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
    canvasStretchingCost: string;
    engravedPlaqueCost: string;
    ledsCost: string;
    shadowboxFittingCost: string;
    additionalLaborCost: string;
    extraMatOpeningsCost: string;
  };
  // Bill of Materials for stacker frames (production ordering format)
  bom?: string[];
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

// Helper function to format decimal as fraction string for BOM (e.g., 17.25 → "17-1/4", 19.5 → "19-1/2")
function formatAsFraction(decimal: number): string {
  const whole = Math.floor(decimal);
  const fractional = decimal - whole;
  
  // If no fractional part, return whole number
  if (fractional < 0.001) {
    return whole.toString();
  }
  
  // Common fractions used in framing (in order of precision)
  const fractions = [
    { decimal: 1/2, string: "1/2" },
    { decimal: 1/4, string: "1/4" },
    { decimal: 3/4, string: "3/4" },
    { decimal: 1/8, string: "1/8" },
    { decimal: 3/8, string: "3/8" },
    { decimal: 5/8, string: "5/8" },
    { decimal: 7/8, string: "7/8" },
    { decimal: 1/16, string: "1/16" },
    { decimal: 3/16, string: "3/16" },
    { decimal: 5/16, string: "5/16" },
    { decimal: 7/16, string: "7/16" },
    { decimal: 9/16, string: "9/16" },
    { decimal: 11/16, string: "11/16" },
    { decimal: 13/16, string: "13/16" },
    { decimal: 15/16, string: "15/16" },
  ];
  
  // Find closest fraction match (within 0.01 tolerance)
  for (const frac of fractions) {
    if (Math.abs(fractional - frac.decimal) < 0.01) {
      return whole > 0 ? `${whole}-${frac.string}` : frac.string;
    }
  }
  
  // If no close fraction match, format as decimal
  return decimal.toFixed(2).replace(/\.?0+$/, '');
}

// Calculate optimal stacker frame combination for desired shadow depth
// Uses dynamic programming to find minimum-cost combination that meets/exceeds desired depth
function calculateStackerFrames(
  desiredDepth: number,
  topperSku: string | undefined,
  width: number,
  height: number,
  matBorderAll: number,
  matBorderLeft: number,
  matBorderRight: number,
  matBorderTop: number,
  matBorderBottom: number,
  config: any
): { layers: { sku: string; depth: number; quantity: number; cost: number }[]; totalCost: number; assemblyCharge: number; topper?: { sku: string; depth: number; cost: number } } {
  if (desiredDepth <= 0) {
    return { layers: [], totalCost: 0, assemblyCharge: 0 };
  }

  // Calculate frame outer dimensions (including mat borders)
  const frameWidth = width + (2 * matBorderAll) + matBorderLeft + matBorderRight;
  const frameHeight = height + (2 * matBorderAll) + matBorderTop + matBorderBottom;
  
  // Calculate perimeter in feet
  const perimeterInches = 2 * (frameWidth + frameHeight);
  const perimeterFeet = perimeterInches / 12;

  // Handle topper piece
  let topperData: { sku: string; depth: number; cost: number } | undefined;
  let baseDepth = desiredDepth;
  
  if (topperSku && config.topperPieces) {
    const topper = config.topperPieces.find((t: any) => t.sku === topperSku);
    if (topper) {
      topperData = {
        sku: topper.sku,
        depth: topper.depth,
        cost: perimeterFeet * topper.pricePerFt,
      };
      // Subtract topper depth from desired depth for base layer calculation
      baseDepth = Math.max(0, desiredDepth - topper.depth);
    }
  }

  const stackerFrames = config.stackerFrames;
  
  // Dynamic programming approach: find minimum cost for each depth level
  // We need to find combinations that reach at least baseDepth with minimum cost
  // Scale depth to avoid floating point issues (multiply by 100 to work with integers)
  const SCALE = 100;
  const targetDepth = Math.ceil(baseDepth * SCALE);
  const maxDepth = targetDepth + Math.max(...stackerFrames.map((f: any) => f.depth)) * SCALE; // Allow some overshoot
  
  // dp[d] = { cost: number, combination: Map<sku, quantity> }
  const dp: Array<{ cost: number; combination: Map<string, number> }> = new Array(maxDepth + 1).fill(null).map(() => ({
    cost: Infinity,
    combination: new Map()
  }));
  dp[0] = { cost: 0, combination: new Map() };

  // Fill DP table
  for (let d = 0; d <= maxDepth; d++) {
    if (dp[d].cost === Infinity) continue;
    
    for (const frame of stackerFrames) {
      const frameDepthScaled = Math.round(frame.depth * SCALE);
      const newDepth = d + frameDepthScaled;
      if (newDepth > maxDepth) continue;
      
      const frameCost = perimeterFeet * frame.pricePerFt;
      const newCost = dp[d].cost + frameCost;
      
      if (newCost < dp[newDepth].cost) {
        const newCombination = new Map(dp[d].combination);
        newCombination.set(frame.sku, (newCombination.get(frame.sku) || 0) + 1);
        dp[newDepth] = { cost: newCost, combination: newCombination };
      }
    }
  }

  // Find the minimum cost solution that meets or exceeds targetDepth
  let bestSolution = { cost: Infinity, combination: new Map<string, number>(), actualDepth: 0 };
  for (let d = targetDepth; d <= maxDepth; d++) {
    if (dp[d].cost < bestSolution.cost) {
      bestSolution = { cost: dp[d].cost, combination: dp[d].combination, actualDepth: d };
    }
  }

  // Convert solution to layers format
  const layers: { sku: string; depth: number; quantity: number; cost: number }[] = [];
  for (const [sku, quantity] of Array.from(bestSolution.combination.entries())) {
    const frame = stackerFrames.find((f: any) => f.sku === sku);
    if (frame && quantity > 0) {
      const layerCost = perimeterFeet * frame.pricePerFt * quantity;
      layers.push({
        sku: frame.sku,
        depth: frame.depth,
        quantity,
        cost: layerCost,
      });
    }
  }

  // Calculate total frame cost
  const frameCost = layers.reduce((sum, layer) => sum + layer.cost, 0);
  
  // Assembly charge is per piece (each layer + topper)
  const totalPieces = layers.reduce((sum, layer) => sum + layer.quantity, 0) + (topperData ? 1 : 0);
  const assemblyCharge = config.stackerAssemblyCharge * totalPieces;
  
  const topperCost = topperData ? topperData.cost : 0;
  const totalCost = frameCost + topperCost + assemblyCharge;

  return { layers, totalCost, assemblyCharge, topper: topperData };
}

/**
 * Apply tiered markup to a base cost
 * Uses markup tiers to adjust pricing based on cost ranges
 * Formula: baseCost × (globalMarkup × tierFactor)
 * 
 * @param baseCost - The base cost before markup
 * @param config - Pricing configuration with markup and markupTiers
 * @param applyMinimum - Whether to apply minimum price floor (default: false, only for frame/total)
 * @returns The retail price after tiered markup
 */
function applyTieredMarkup(baseCost: number, config: any, applyMinimum: boolean = false): number {
  if (baseCost <= 0) return 0;
  
  // Find the appropriate tier for this cost
  const tier = config.markupTiers?.find(
    (t: any) => baseCost >= t.minCost && baseCost < t.maxCost
  );
  
  // If no tier found (shouldn't happen with Infinity max), use global markup
  const tierFactor = tier ? tier.factor : 1.0;
  
  // Calculate effective markup: globalMarkup × tierFactor
  const effectiveMarkup = config.markup * tierFactor;
  
  // Apply markup to base cost
  let retailPrice = baseCost * effectiveMarkup;
  
  // Apply minimum price floor only if requested (for frames or total order)
  if (applyMinimum && config.minimumPrice && retailPrice < config.minimumPrice) {
    retailPrice = config.minimumPrice;
  }
  
  return retailPrice;
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
      order.topperSku,
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
    const joinCost = mouldingData?.joinCost || 0;
    
    // Calculate Join Feet
    // Formula: (United Inches × 2) + 8" scrap, divided by 12, rounded up, minimum 4ft
    let joinFt: number;
    if (order.chopOnly) {
      joinFt = config.chopOnlyJoinFt;
    } else {
      joinFt = Math.max(4, Math.ceil((unitedInchesX2 + 8) / 12));
    }
    
    frameCost = joinCost * joinFt;
  }
  
  // Determine if this is a standalone component order (no frame)
  // Stacker frames are never considered standalone, even if frameSku is empty
  const isStandaloneOrder = !order.stackerFrame && (!order.frameSku || order.frameSku.trim() === "" || order.frameSku === "None");
  
  // Track individual component costs for breakdown
  let mat1CostBase = 0;
  let mat2CostBase = 0;
  let mat3CostBase = 0;
  let acrylicCostBase = 0;
  let backingCostBase = 0;
  let printPaperCostBase = 0;
  let dryMountCostBase = 0;
  let printCanvasCostBase = 0;
  let canvasStretchingCostBase = 0;
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
    acrylicCostBase = (acrylicPrice?.pricePerSqIn || 0) * squareInches;
    addOnCosts += acrylicCostBase;
  }
  
  // Backing cost (per square inch) - use dynamic config
  if (order.backingSku && order.backingSku !== 'None') {
    const backingPrice = config.backingPrices.find(p => p.type === order.backingSku);
    backingCostBase = (backingPrice?.pricePerSqIn || 0) * squareInches;
    addOnCosts += backingCostBase;
  }
  
  // Mat costs - using Annie sheet supply data only (no April supplement)
  // Mat prices from Annie sheet will be marked up by the global markup (3.5×)
  if (order.mat1Sku) {
    const mat1 = getSupply(order.mat1Sku);
    mat1CostBase = (mat1?.price || 15);
    addOnCosts += mat1CostBase;
  }
  if (order.mat2Sku) {
    const mat2 = getSupply(order.mat2Sku);
    mat2CostBase = (mat2?.price || 15);
    addOnCosts += mat2CostBase;
  }
  if (order.mat3Sku) {
    const mat3 = getSupply(order.mat3Sku);
    mat3CostBase = (mat3?.price || 15);
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
  if (order.canvasStretching) {
    // Canvas stretching is 10% below gallery canvas price ($0.08 × 0.90 = $0.072)
    canvasStretchingCostBase = 0.072 * squareInches;
    addOnCosts += canvasStretchingCostBase;
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
  
  // Calculate Item Total with Markup
  // For standalone component orders: apply flat 3.5× markup
  // For orders with frames: apply tiered markup to each component
  let itemTotal: number;
  
  // Store retail prices for breakdown calculation
  let frameRetail: number, mat1Retail: number, mat2Retail: number, mat3Retail: number;
  let acrylicRetail: number, backingRetail: number, printPaperRetail: number;
  let dryMountRetail: number, printCanvasRetail: number, canvasStretchingRetail: number;
  let engravedPlaqueRetail: number, ledsRetail: number, shadowboxFittingRetail: number;
  let additionalLaborRetail: number, extraMatOpeningsRetail: number;
  let minimumApplied = false;
  
  if (isStandaloneOrder) {
    // Standalone component orders: apply configurable flat markup to all components
    const standaloneMarkup = config.standaloneComponentMarkup;
    frameRetail = frameCost * standaloneMarkup; // Should be 0 for standalone
    mat1Retail = mat1CostBase * standaloneMarkup;
    mat2Retail = mat2CostBase * standaloneMarkup;
    mat3Retail = mat3CostBase * standaloneMarkup;
    acrylicRetail = acrylicCostBase * standaloneMarkup;
    backingRetail = backingCostBase * standaloneMarkup;
    printPaperRetail = printPaperCostBase * standaloneMarkup;
    dryMountRetail = dryMountCostBase * standaloneMarkup;
    printCanvasRetail = printCanvasCostBase * standaloneMarkup;
    canvasStretchingRetail = canvasStretchingCostBase * standaloneMarkup;
    engravedPlaqueRetail = engravedPlaqueCostBase * standaloneMarkup;
    ledsRetail = ledsCostBase * standaloneMarkup;
    shadowboxFittingRetail = shadowboxFittingCostBase * standaloneMarkup;
    additionalLaborRetail = additionalLaborCostBase * standaloneMarkup;
    extraMatOpeningsRetail = extraMatOpeningsCostBase * standaloneMarkup;
  } else {
    // Orders with frames: frame uses tiered markup, components use configurable flat markup
    const componentMarkup = config.frameComponentMarkup; // Lower than standalone to incentivize complete orders
    frameRetail = applyTieredMarkup(frameCost, config);
    mat1Retail = mat1CostBase * componentMarkup;
    mat2Retail = mat2CostBase * componentMarkup;
    mat3Retail = mat3CostBase * componentMarkup;
    acrylicRetail = acrylicCostBase * componentMarkup;
    backingRetail = backingCostBase * componentMarkup;
    printPaperRetail = printPaperCostBase * componentMarkup;
    dryMountRetail = dryMountCostBase * componentMarkup;
    printCanvasRetail = printCanvasCostBase * componentMarkup;
    canvasStretchingRetail = canvasStretchingCostBase * componentMarkup;
    engravedPlaqueRetail = engravedPlaqueCostBase * componentMarkup;
    ledsRetail = ledsCostBase * componentMarkup;
    shadowboxFittingRetail = shadowboxFittingCostBase * componentMarkup;
    additionalLaborRetail = additionalLaborCostBase * componentMarkup;
    extraMatOpeningsRetail = extraMatOpeningsCostBase * componentMarkup;
  }
  
  // Sum all retail prices
  let orderSubtotal = 
    frameRetail + 
    mat1Retail + mat2Retail + mat3Retail +
    acrylicRetail + backingRetail +
    printPaperRetail + dryMountRetail +
    printCanvasRetail + canvasStretchingRetail +
    engravedPlaqueRetail + ledsRetail +
    shadowboxFittingRetail + additionalLaborRetail +
    extraMatOpeningsRetail;
  
  // Apply minimum price floor to the total order (before quantity multiplier)
  // Only apply minimum to orders that include a frame (not standalone component orders)
  if (!isStandaloneOrder && config.minimumPrice && orderSubtotal < config.minimumPrice) {
    const scaleFactor = config.minimumPrice / orderSubtotal;
    // Scale all components proportionally
    frameRetail *= scaleFactor;
    mat1Retail *= scaleFactor;
    mat2Retail *= scaleFactor;
    mat3Retail *= scaleFactor;
    acrylicRetail *= scaleFactor;
    backingRetail *= scaleFactor;
    printPaperRetail *= scaleFactor;
    dryMountRetail *= scaleFactor;
    printCanvasRetail *= scaleFactor;
    canvasStretchingRetail *= scaleFactor;
    engravedPlaqueRetail *= scaleFactor;
    ledsRetail *= scaleFactor;
    shadowboxFittingRetail *= scaleFactor;
    additionalLaborRetail *= scaleFactor;
    extraMatOpeningsRetail *= scaleFactor;
    
    orderSubtotal = config.minimumPrice;
    minimumApplied = true;
  }
  
  // Multiply by quantity
  itemTotal = orderSubtotal * quantity;
  
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
  
  // Generate Bill of Materials (BOM) for stacker frames
  let bom: string[] | undefined;
  if (stackerFrameData && order.stackerFrame) {
    bom = [];
    // Use actual dimensions with fractions for BOM
    const interiorWidth = formatAsFraction(width);
    const interiorHeight = formatAsFraction(height);
    
    // Add stacker frame layers
    for (const layer of stackerFrameData.layers) {
      bom.push(`${layer.sku}_${interiorWidth}x${interiorHeight}_(${layer.quantity})`);
    }
    
    // Add topper piece
    if (stackerFrameData.topper) {
      bom.push(`${stackerFrameData.topper.sku}_${interiorWidth}x${interiorHeight}_(1)`);
    }
  }
  
  // Calculate breakdown using the retail values already calculated above
  // (which include tiered markup and minimum price floor adjustments)
  const breakdown = {
    frameCost: (frameRetail * quantity).toFixed(2),
    mat1Cost: (mat1Retail * quantity).toFixed(2),
    mat2Cost: (mat2Retail * quantity).toFixed(2),
    mat3Cost: (mat3Retail * quantity).toFixed(2),
    acrylicCost: (acrylicRetail * quantity).toFixed(2),
    backingCost: (backingRetail * quantity).toFixed(2),
    printPaperCost: (printPaperRetail * quantity).toFixed(2),
    dryMountCost: (dryMountRetail * quantity).toFixed(2),
    printCanvasCost: (printCanvasRetail * quantity).toFixed(2),
    canvasStretchingCost: (canvasStretchingRetail * quantity).toFixed(2),
    engravedPlaqueCost: (engravedPlaqueRetail * quantity).toFixed(2),
    ledsCost: (ledsRetail * quantity).toFixed(2),
    shadowboxFittingCost: (shadowboxFittingRetail * quantity).toFixed(2),
    additionalLaborCost: (additionalLaborRetail * quantity).toFixed(2),
    extraMatOpeningsCost: (extraMatOpeningsRetail * quantity).toFixed(2),
  };
  
  return {
    itemTotal: itemTotal.toFixed(2),
    shipping: shipping.toFixed(2),
    salesTax: salesTax > 0 ? salesTax.toFixed(2) : "",
    total: total.toFixed(2),
    balance: balance.toFixed(2),
    breakdown,
    bom,
  };
}

// Multi-item pricing interfaces
export interface MultiItemPricingInput {
  items: InsertOrder[];
  customerAddress: {
    cityStateZip?: string;
  };
  deliveryMethod?: string;
  discount?: string;
  deposit?: string;
}

export interface MultiItemPricingResult {
  items: (PricingResult & { itemNumber: number })[];
  subtotal: string;
  shipping: string;
  salesTax: string;
  total: string;
  balance: string;
}

// Calculate pricing for multiple items in a single order
export function calculateMultiItemPricing(input: MultiItemPricingInput): MultiItemPricingResult {
  // Calculate pricing for each item
  const itemResults = input.items.map((item, index) => {
    const itemPrice = calculatePricing(item);
    return {
      ...itemPrice,
      itemNumber: index + 1,
    };
  });

  // Sum all item totals (excluding shipping which is order-level)
  const subtotalNum = itemResults.reduce((sum, item) => {
    return sum + parseFloat(item.itemTotal);
  }, 0);

  // Calculate shipping based on delivery method and largest united inches
  let shippingNum = 0;
  if (input.deliveryMethod !== 'pickup') {
    // Find the item with the largest united inches for shipping calculation
    const config = pricingConfigStorage.getConfig();
    let maxUnitedInches = 0;
    
    for (const item of input.items) {
      const width = parseFraction(item.width);
      const height = parseFraction(item.height);
      const unitedInches = width + height;
      maxUnitedInches = Math.max(maxUnitedInches, unitedInches);
    }

    // Find shipping rate based on largest united inches
    const shippingRate = config.shippingRates.find(
      (r) => maxUnitedInches >= r.min && maxUnitedInches <= r.max
    );
    shippingNum = shippingRate ? shippingRate.rate : 0;

    // Add remote destination surcharge if applicable
    const cityStateZip = input.customerAddress?.cityStateZip || "";
    const isRemoteDestination = /\b(HI|AK|PR)\b/i.test(cityStateZip);
    if (isRemoteDestination && maxUnitedInches < 75) {
      shippingNum += 99;
    }
  }

  // Calculate sales tax (7% if in NJ)
  const cityStateZip = input.customerAddress?.cityStateZip || "";
  const isTaxable = /\bNJ\b/i.test(cityStateZip);
  const salesTaxNum = isTaxable ? subtotalNum * 0.07 : 0;

  // Calculate total (discount is text field, not applied in calculation)
  const totalNum = subtotalNum + shippingNum + salesTaxNum;

  // Calculate balance (deposit is text field, parse it)
  const depositNum = parseFraction(input.deposit);
  const balanceNum = totalNum - depositNum;

  return {
    items: itemResults,
    subtotal: subtotalNum.toFixed(2),
    shipping: shippingNum.toFixed(2),
    salesTax: salesTaxNum > 0 ? salesTaxNum.toFixed(2) : "",
    total: totalNum.toFixed(2),
    balance: balanceNum.toFixed(2),
  };
}
