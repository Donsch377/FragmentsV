import type { Unit } from "../models/types";

export const formatQuantity = (qty: number | null | undefined, unit?: Unit | null) => {
  if (qty == null) {
    return "—";
  }
  const rounded = Number.isInteger(qty) ? qty : qty.toFixed(1);
  return unit ? `${rounded} ${unit}` : String(rounded);
};

export const formatDate = (timestamp: number) => {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
};
