import type { Unit } from "../models/types";

const FACTORS: Record<Unit, number> = {
  g: 1,
  ml: 1,
  pcs: 1,
};

export const toBase = (value: number, unit: Unit): number => {
  const factor = FACTORS[unit];
  return value * factor;
};

export const toDisplay = (
  baseQty: number,
  baseUnit: Unit,
  displayUnit?: Unit | null
): number => {
  if (!displayUnit || displayUnit === baseUnit) {
    return baseQty;
  }

  const baseFactor = FACTORS[baseUnit];
  const displayFactor = FACTORS[displayUnit];

  if (!displayFactor) {
    return baseQty;
  }

  return (baseQty * baseFactor) / displayFactor;
};
