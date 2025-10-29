/**
 * Parses a string that may contain fractions, decimals, or mixed fractions
 * Examples: "16 1/2", "16-1/2", "1/2", "12.5"
 */
export function parseFraction(input: string): number {
  if (!input || input.trim() === "") return 0;
  
  const str = input.trim();
  
  // Check if it's a mixed fraction like "16 1/2" or "16-1/2"
  const mixedMatch = str.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + (numerator / denominator);
  }
  
  // Check if it's a simple fraction like "1/2"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    return numerator / denominator;
  }
  
  // Otherwise parse as decimal
  return parseFloat(str) || 0;
}

/**
 * Parses a discount input that may be a dollar amount ($10) or percentage (10%)
 * Returns the discount amount in dollars
 */
export function parseDiscount(discountInput: string, subtotal: number): number {
  if (!discountInput || discountInput.trim() === "") return 0;
  
  const str = discountInput.trim();
  
  // Check if it's a percentage (e.g., "10%", "15%")
  if (str.includes('%')) {
    const percentValue = parseFloat(str.replace('%', '').trim());
    if (isNaN(percentValue)) return 0;
    return (percentValue / 100) * subtotal;
  }
  
  // Check if it's a dollar amount (e.g., "$10", "$10.50")
  if (str.includes('$')) {
    const dollarValue = parseFloat(str.replace('$', '').trim());
    return isNaN(dollarValue) ? 0 : dollarValue;
  }
  
  // Reject plain numbers - must have $ or %
  return 0;
}
