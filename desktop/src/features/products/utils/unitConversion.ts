/** Convert whole package quantities to the product's base unit. This is a
 * display/calculation helper only; it never reads or changes stock. */
export function toBaseUnits(quantity: number, factor: number): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Enter a positive whole package quantity.");
  }
  if (!Number.isSafeInteger(factor) || factor <= 0) {
    throw new Error("Conversion must be a positive whole number.");
  }
  const result = quantity * factor;
  if (!Number.isSafeInteger(result)) {
    throw new Error("The converted quantity is too large.");
  }
  return result;
}
