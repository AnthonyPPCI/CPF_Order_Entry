import XLSX from 'xlsx';

const workbook = XLSX.readFile('attached_assets/CS_Pricing_Sheet_APR_2025_v1_STORE VERSION_1761245667562.xlsx');

console.log('Available sheets:', workbook.SheetNames);

// Find the DEEP SHADOWS sheet
const deepShadowsSheet = workbook.Sheets['DEEP SHADOWS'];

if (!deepShadowsSheet) {
  console.log('DEEP SHADOWS sheet not found. Available sheets:', workbook.SheetNames);
  process.exit(1);
}

// Convert to JSON to analyze structure
const data = XLSX.utils.sheet_to_json(deepShadowsSheet, { header: 1, defval: '' });

console.log('\n=== DEEP SHADOWS Tab Data ===');
console.log('Total rows:', data.length);
console.log('\nFirst 30 rows:');
data.slice(0, 30).forEach((row, idx) => {
  console.log(`Row ${idx}:`, JSON.stringify(row));
});
