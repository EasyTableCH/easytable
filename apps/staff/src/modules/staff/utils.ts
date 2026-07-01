export function formatChf(amountInRappen: number) {
  return `CHF ${(amountInRappen / 100).toFixed(2)}`;
}

export function formatPriceDelta(amountInRappen: number) {
  if (amountInRappen === 0) {
    return "Ohne Aufpreis";
  }

  return `+${formatChf(amountInRappen)}`;
}
