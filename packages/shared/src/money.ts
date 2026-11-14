// Money (design brief §4): peso sign, comma thousands. Zero reads "Free".
const peso = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatPeso(amount: number) {
  if (amount === 0) return 'Free';
  const cents = Math.round(amount * 100) % 100 !== 0;
  return `₱${cents ? amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : peso.format(amount)}`;
}

// "₱800 to ₱1,500", one price when all match, or null with none.
export function formatPriceRange(amounts: number[]) {
  if (amounts.length === 0) return null;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return min === max ? formatPeso(min) : `${formatPeso(min)} to ${formatPeso(max)}`;
}
