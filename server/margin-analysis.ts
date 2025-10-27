import type { 
  InsertOrder, 
  LaborCostConfig, 
  BusinessMetrics, 
  MarginAnalysis,
  ScenarioAnalysis 
} from "@shared/schema";
import { calculatePricing, parseFraction } from "./pricing";

// Default labor cost configuration
export const DEFAULT_LABOR_CONFIG: LaborCostConfig = {
  smallFrameLabor: 7,          // < 60 UI
  mediumFrameLabor: 10,        // 60-120 UI
  largeFrameLabor: 14,         // > 120 UI
  matComplexityAdder: 2,       // Per mat
  stackerComplexityAdder: 5,   // Stacker assembly
};

// Default business metrics
export const DEFAULT_BUSINESS_METRICS: BusinessMetrics = {
  marketingPercent: 25,
  monthlyOverhead: 50000,
  monthlyFrameVolume: 22000,
};

/**
 * Calculate labor cost for an order based on size and complexity
 */
export function calculateLaborCost(
  order: InsertOrder,
  config: LaborCostConfig = DEFAULT_LABOR_CONFIG
): number {
  // Parse dimensions
  const width = parseFraction(order.width);
  const height = parseFraction(order.height);
  
  // Parse mat borders
  const matBorderAll = parseFraction(order.matBorderAll);
  const matBorderLeft = parseFraction(order.matBorderLeft);
  const matBorderRight = parseFraction(order.matBorderRight);
  const matBorderTop = parseFraction(order.matBorderTop);
  const matBorderBottom = parseFraction(order.matBorderBottom);
  const mat1Reveal = parseFraction(order.mat1Reveal);
  const mat2Reveal = parseFraction(order.mat2Reveal);
  
  // Calculate United Inches (frame size metric)
  const unitedInches = (
    (width + 2 * matBorderAll + matBorderLeft + matBorderRight)
    + (height + 2 * matBorderAll + matBorderTop + matBorderBottom)
    + mat1Reveal + mat2Reveal
  );
  
  // Base labor cost by frame size
  let laborCost = 0;
  if (unitedInches < 60) {
    laborCost = config.smallFrameLabor;
  } else if (unitedInches <= 120) {
    laborCost = config.mediumFrameLabor;
  } else {
    laborCost = config.largeFrameLabor;
  }
  
  // Add complexity costs
  let matCount = 0;
  if (order.mat1Sku) matCount++;
  if (order.mat2Sku) matCount++;
  if (order.mat3Sku) matCount++;
  
  if (matCount > 0) {
    laborCost += matCount * config.matComplexityAdder;
  }
  
  // Stacker frames require additional assembly
  if (order.stackerFrame && order.shadowDepth) {
    laborCost += config.stackerComplexityAdder;
  }
  
  return laborCost;
}

/**
 * Analyze margin for a single order
 */
export function analyzeMargin(
  order: InsertOrder,
  laborConfig: LaborCostConfig = DEFAULT_LABOR_CONFIG,
  businessMetrics: BusinessMetrics = DEFAULT_BUSINESS_METRICS
): MarginAnalysis {
  // Validate business metrics to prevent NaN/Infinity/undefined
  if (!Number.isFinite(businessMetrics.monthlyFrameVolume) || businessMetrics.monthlyFrameVolume <= 0) {
    throw new Error('Monthly frame volume must be a positive number');
  }
  if (!Number.isFinite(businessMetrics.marketingPercent) || businessMetrics.marketingPercent < 0 || businessMetrics.marketingPercent > 100) {
    throw new Error('Marketing percent must be a number between 0 and 100');
  }
  if (!Number.isFinite(businessMetrics.monthlyOverhead) || businessMetrics.monthlyOverhead < 0) {
    throw new Error('Monthly overhead must be a non-negative number');
  }
  
  // Validate labor config
  if (!Number.isFinite(laborConfig.smallFrameLabor) || laborConfig.smallFrameLabor < 0) {
    throw new Error('Small frame labor must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.mediumFrameLabor) || laborConfig.mediumFrameLabor < 0) {
    throw new Error('Medium frame labor must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.largeFrameLabor) || laborConfig.largeFrameLabor < 0) {
    throw new Error('Large frame labor must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.matComplexityAdder) || laborConfig.matComplexityAdder < 0) {
    throw new Error('Mat complexity adder must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.stackerComplexityAdder) || laborConfig.stackerComplexityAdder < 0) {
    throw new Error('Stacker complexity adder must be a non-negative number');
  }
  
  // Get pricing calculation
  const pricingResult = calculatePricing(order);
  const retailPrice = parseFloat(pricingResult.itemTotal);
  
  // Validate retail price
  if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
    throw new Error('Retail price must be a positive number');
  }
  
  // Calculate material cost (sum of all BASE cost components before markup)
  const baseCosts = pricingResult.baseCosts;
  const materialCost = 
    parseFloat(baseCosts.frameCost || '0') +
    parseFloat(baseCosts.mat1Cost || '0') +
    parseFloat(baseCosts.mat2Cost || '0') +
    parseFloat(baseCosts.mat3Cost || '0') +
    parseFloat(baseCosts.acrylicCost || '0') +
    parseFloat(baseCosts.backingCost || '0') +
    parseFloat(baseCosts.printPaperCost || '0') +
    parseFloat(baseCosts.dryMountCost || '0') +
    parseFloat(baseCosts.printCanvasCost || '0') +
    parseFloat(baseCosts.canvasStretchingCost || '0') +
    parseFloat(baseCosts.engravedPlaqueCost || '0') +
    parseFloat(baseCosts.ledsCost || '0') +
    parseFloat(baseCosts.shadowboxFittingCost || '0') +
    parseFloat(baseCosts.additionalLaborCost || '0') +
    parseFloat(baseCosts.extraMatOpeningsCost || '0');
  
  // Determine order type
  let orderType: 'Stacker Frame' | 'Full Frame' | 'Component';
  const hasFrame = parseFloat(baseCosts.frameCost || '0') > 0;
  const hasAcrylic = parseFloat(baseCosts.acrylicCost || '0') > 0;
  const hasBacking = parseFloat(baseCosts.backingCost || '0') > 0;
  
  if (order.stackerFrame && order.shadowDepth) {
    orderType = 'Stacker Frame';
  } else if (hasFrame && hasAcrylic && hasBacking) {
    orderType = 'Full Frame';
  } else {
    orderType = 'Component';
  }
  
  // Calculate labor cost
  const laborCost = calculateLaborCost(order, laborConfig);
  
  // Calculate marketing cost
  const marketingCost = retailPrice * (businessMetrics.marketingPercent / 100);
  
  // Calculate overhead allocation per frame
  const overheadAllocation = businessMetrics.monthlyOverhead / businessMetrics.monthlyFrameVolume;
  
  // Calculate margins
  const grossMargin = retailPrice - materialCost;
  const grossMarginPercent = (grossMargin / retailPrice) * 100;
  
  const contributionMargin = grossMargin - marketingCost - laborCost - overheadAllocation;
  const contributionMarginPercent = (contributionMargin / retailPrice) * 100;
  
  // Health indicators
  const isHealthy = contributionMarginPercent >= 20;
  const isWarning = contributionMarginPercent < 15;
  
  return {
    orderType,
    retailPrice,
    materialCost,
    marketingCost,
    laborCost,
    overheadAllocation,
    grossMargin,
    grossMarginPercent,
    contributionMargin,
    contributionMarginPercent,
    isHealthy,
    isWarning,
  };
}

/**
 * Run scenario analysis with predefined test cases
 */
export function runScenarioAnalysis(
  laborConfig: LaborCostConfig = DEFAULT_LABOR_CONFIG,
  businessMetrics: BusinessMetrics = DEFAULT_BUSINESS_METRICS
): ScenarioAnalysis {
  // Validate business metrics before running scenarios
  if (!Number.isFinite(businessMetrics.monthlyFrameVolume) || businessMetrics.monthlyFrameVolume <= 0) {
    throw new Error('Monthly frame volume must be a positive number');
  }
  if (!Number.isFinite(businessMetrics.marketingPercent) || businessMetrics.marketingPercent < 0 || businessMetrics.marketingPercent > 100) {
    throw new Error('Marketing percent must be a number between 0 and 100');
  }
  if (!Number.isFinite(businessMetrics.monthlyOverhead) || businessMetrics.monthlyOverhead < 0) {
    throw new Error('Monthly overhead must be a non-negative number');
  }
  
  // Validate labor config
  if (!Number.isFinite(laborConfig.smallFrameLabor) || laborConfig.smallFrameLabor < 0) {
    throw new Error('Small frame labor must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.mediumFrameLabor) || laborConfig.mediumFrameLabor < 0) {
    throw new Error('Medium frame labor must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.largeFrameLabor) || laborConfig.largeFrameLabor < 0) {
    throw new Error('Large frame labor must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.matComplexityAdder) || laborConfig.matComplexityAdder < 0) {
    throw new Error('Mat complexity adder must be a non-negative number');
  }
  if (!Number.isFinite(laborConfig.stackerComplexityAdder) || laborConfig.stackerComplexityAdder < 0) {
    throw new Error('Stacker complexity adder must be a non-negative number');
  }
  
  const scenarios = [
    {
      name: "Small Frame Only",
      description: "8×10 frame, no mat, no acrylic/backing (Component pricing 5.5×)",
      order: {
        width: "8",
        height: "10",
        frameSku: "8694",
        deliveryMethod: "pickup",
        quantity: 1,
      } as InsertOrder,
    },
    {
      name: "Medium Full Frame",
      description: "16×20 with mat, acrylic, backing (Full Frame pricing 4.5×)",
      order: {
        width: "16",
        height: "20",
        frameSku: "8694",
        mat1Sku: "4003",
        matBorderAll: "3",
        acrylicType: "Standard",
        backingSku: "White Foam",
        deliveryMethod: "pickup",
        quantity: 1,
      } as InsertOrder,
    },
    {
      name: "Large Full Frame with Mats",
      description: "24×36 with double mat, acrylic, backing (Full Frame 4.5×)",
      order: {
        width: "24",
        height: "36",
        frameSku: "8694",
        mat1Sku: "4003",
        mat1Reveal: "0.25",
        mat2Sku: "4004",
        matBorderAll: "3",
        acrylicType: "Standard",
        backingSku: "White Foam",
        deliveryMethod: "pickup",
        quantity: 1,
      } as InsertOrder,
    },
    {
      name: "Stacker Frame (3-inch)",
      description: "16×20 stacker, 3-inch depth (Stacker pricing 2.5×)",
      order: {
        width: "16",
        height: "20",
        stackerFrame: true,
        shadowDepth: "3",
        deliveryMethod: "pickup",
        quantity: 1,
      } as InsertOrder,
    },
    {
      name: "Acrylic Only",
      description: "20×24 acrylic sheet, no frame (Component pricing 5.5×)",
      order: {
        width: "20",
        height: "24",
        acrylicType: "Standard",
        deliveryMethod: "pickup",
        quantity: 1,
      } as InsertOrder,
    },
    {
      name: "Print + Frame Package",
      description: "11×14 with print, dry mount, full frame (Full Frame 4.5×)",
      order: {
        width: "11",
        height: "14",
        frameSku: "8694",
        printPaper: true,
        printPaperType: "Glossy",
        dryMount: true,
        mat1Sku: "4003",
        matBorderAll: "2.5",
        acrylicType: "Standard",
        backingSku: "White Foam",
        deliveryMethod: "pickup",
        quantity: 1,
      } as InsertOrder,
    },
  ];
  
  const results = scenarios.map(scenario => ({
    name: scenario.name,
    description: scenario.description,
    analysis: analyzeMargin(scenario.order, laborConfig, businessMetrics),
  }));
  
  // Calculate aggregate metrics
  const totalMargin = results.reduce((sum, r) => sum + r.analysis.contributionMarginPercent, 0);
  const averageMargin = totalMargin / results.length;
  const healthyCount = results.filter(r => r.analysis.isHealthy).length;
  const warningCount = results.filter(r => r.analysis.isWarning).length;
  
  return {
    scenarios: results,
    averageMargin,
    healthyCount,
    warningCount,
  };
}
