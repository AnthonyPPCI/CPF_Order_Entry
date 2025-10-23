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

  const excelPath = join(process.cwd(), 'attached_assets', 'ANNIE CPF Order Entry Sheet (1)_1761234370780.xlsx');
  console.log('[Pricing] Loading pricing data from:', excelPath);
  const workbook = XLSX.readFile(excelPath);

  // Load Moulding Data
  const mouldingSheet = workbook.Sheets['Moulding'];
  const mouldingData = XLSX.utils.sheet_to_json(mouldingSheet, { header: 1, defval: '' }) as any[];
  const mouldings = new Map<string, MouldingData>();

  for (let i = 1; i < mouldingData.length; i++) {
    const row = mouldingData[i];
    if (row[0]) {  // Has SKU
      mouldings.set(String(row[0]), {
        sku: String(row[0]),
        width: Number(row[1] || 0),
        supplier: String(row[2] || ''),
        description: String(row[3] || ''),
        retailPrice: Number(row[4] || 0),
        discountPercent: Number(row[5] || 0),
        costPerFoot: Number(row[6] || 0),
        chop: Number(row[7] || 0),
        joinCost: Number(row[8] || 0),
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
      supplies.set(String(row[0]), {
        sku: String(row[0]),
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
