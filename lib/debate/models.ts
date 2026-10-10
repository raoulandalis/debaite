export function sameSizeBand(leftBillions: number, rightBillions: number): boolean {
  if (!Number.isFinite(leftBillions) || !Number.isFinite(rightBillions)) {
    return false;
  }
  if (leftBillions <= 0 || rightBillions <= 0) {
    return false;
  }
  const larger = Math.max(leftBillions, rightBillions);
  const smaller = Math.min(leftBillions, rightBillions);
  return larger / smaller <= 1.5;
}
