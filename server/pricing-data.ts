import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MouldingData {
  sku: string;
  width: number;
  supplier: string;
  description: string;
  retailPrice: number;
  discountPercent: number;
  costPerFoot: number;
  chop: number;
  joinCost: number;
}

export interface SupplyData {
  sku: string;
  name: string;
  price: number;
  itemType: string;
}

export interface PricingData {
  mouldings: Map<string, MouldingData>;
  supplies: Map<string, SupplyData>;
  markup: number;
  chopOnlyJoinFt: number;
}

let pricingDataCache: PricingData | null = null;

export function loadPricingData(): PricingData {
  if (pricingDataCache) {
    return pricingDataCache;
  }

  const excelPath = join(process.cwd(), 'attached_assets', 'ANNIE CPF Order Entry Sheet (1)_1761323171381.xlsx');
  console.log('[Pricing] Loading pricing data from NEW Annie sheet:', excelPath);
  const workbook = XLSX.readFile(excelPath);

  // Load Moulding Data
  const mouldingSheet = workbook.Sheets['Moulding'];
  const mouldingData = XLSX.utils.sheet_to_json(mouldingSheet, { header: 1, defval: '' }) as any[];
  const mouldings = new Map<string, MouldingData>();

  for (let i = 1; i < mouldingData.length; i++) {
    const row = mouldingData[i];
    if (row[0]) {  // Has SKU
      // Column L (index 11): if "yes", use Column J (index 9), otherwise use Column I (index 8)
      const useSpecialPricing = String(row[11]).toLowerCase() === 'yes';
      const joinCost = useSpecialPricing ? Number(row[9] || 0) : Number(row[8] || 0);
      
      mouldings.set(String(row[0]), {
        sku: String(row[0]),
        width: Number(row[1] || 0),
        supplier: String(row[2] || ''),
        description: String(row[3] || ''),
        retailPrice: Number(row[4] || 0),
        discountPercent: Number(row[5] || 0),
        costPerFoot: Number(row[6] || 0),
        chop: Number(row[7] || 0),
        joinCost: joinCost,
      });
    }
  }

  // Load Supply Data
  const supplySheet = workbook.Sheets['Supply'];
  const supplyData = XLSX.utils.sheet_to_json(supplySheet, { header: 1, defval: '' }) as any[];
  const supplies = new Map<string, SupplyData>();

  for (let i = 1; i < supplyData.length; i++) {
    const row = supplyData[i];
    if (row[0]) {  // Has SKU
      const rawSku = String(row[0]);
      // Extract just the SKU part (before first " - ") for mat SKUs that are formatted as "SKU - Name - Description"
      const skuPart = rawSku.includes(' - ') ? rawSku.split(' - ')[0].trim() : rawSku;
      
      supplies.set(skuPart, {
        sku: skuPart,
        name: String(row[1] || ''),
        price: Number(row[3] || 0),
        itemType: String(row[5] || ''),
      });
    }
  }

  // Add F101 as a copy of 8694
  const moulding8694 = mouldings.get('8694');
  if (moulding8694) {
    mouldings.set('F101', {
      ...moulding8694,
      sku: 'F101',
    });
  }

  // Load supplementary data from April 2025 pricing sheet
  const newPricingPath = join(process.cwd(), 'attached_assets', 'CS_Pricing_Sheet_APR_2025_v1_STORE VERSION_1761319469111.xlsx');
  try {
    const newWorkbook = XLSX.readFile(newPricingPath);
    
    // Load missing mouldings
    const newMouldingSheet = newWorkbook.Sheets['moulding'];
    const newMouldingData = XLSX.utils.sheet_to_json(newMouldingSheet, { header: 1, defval: '' }) as any[];
    
    let addedMouldingsCount = 0;
    for (let i = 1; i < newMouldingData.length; i++) {
      const row = newMouldingData[i];
      if (row[0]) {
        const sku = String(row[0]);
        
        // Only add if it doesn't exist in Annie data
        if (!mouldings.has(sku)) {
          // April 2025 sheet uses different methodology - join price already includes costs
          // Divide by 2.75 to get base cost that our markup will be applied to
          const joinPriceRetail = Number(row[14] || 0);
          const joinCostBase = joinPriceRetail / 2.75;
          
          mouldings.set(sku, {
            sku: sku,
            width: Number(row[7] || 0),
            supplier: String(row[17] || ''), // VENDOR
            description: String(row[2] || ''),
            retailPrice: 0,
            discountPercent: 0,
            costPerFoot: Number(row[12] || 0),
            chop: Number(row[13] || 0) / 2.75, // Convert retail to base
            joinCost: joinCostBase, // Convert retail to base cost
          });
          addedMouldingsCount++;
        }
      }
    }
    console.log(`Added ${addedMouldingsCount} missing mouldings from April 2025 pricing sheet`);
    
    // Load missing mats from April 2025 "mats" sheet
    const matsSheet = newWorkbook.Sheets['mats'];
    const matsData = XLSX.utils.sheet_to_json(matsSheet, { header: 1, defval: '' }) as any[];
    
    let addedMatsCount = 0;
    for (let i = 1; i < matsData.length; i++) {
      const row = matsData[i];
      if (row[1]) {  // MatSku column
        const sku = String(row[1]);
        
        // Only add if it doesn't exist in supplies
        if (!supplies.has(sku)) {
          const costPerSheet = Number(row[5] || 0);  // Column 5: Cost Per Sheet
          const matName = String(row[2] || '');  // Column 2: MatColor
          
          // Mats need 5× retail markup, but general 2.75× markup will be applied later
          // So store at: (cost × 5) / 2.75 = cost × 1.818 to get correct final price
          const matPricePreGeneralMarkup = costPerSheet * (5.0 / 2.75);
          
          supplies.set(sku, {
            sku: sku,
            name: matName,
            price: matPricePreGeneralMarkup,
            itemType: 'Mat',
          });
          addedMatsCount++;
        }
      }
    }
    console.log(`Added ${addedMatsCount} missing mats from April 2025 pricing sheet`);
  } catch (error) {
    console.log('[Pricing] Could not load supplementary pricing sheet:', error);
  }

  pricingDataCache = {
    mouldings,
    supplies,
    markup: 2.75,
    chopOnlyJoinFt: 18,
  };

  console.log(`Loaded ${mouldings.size} mouldings and ${supplies.size} supplies`);
  
  return pricingDataCache;
}

export function getMoulding(sku: string): MouldingData | undefined {
  const data = loadPricingData();
  return data.mouldings.get(sku);
}

export function getSupply(sku: string): SupplyData | undefined {
  const data = loadPricingData();
  return data.supplies.get(sku);
}
