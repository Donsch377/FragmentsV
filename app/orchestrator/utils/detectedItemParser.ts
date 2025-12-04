import type { DetectedItem } from "../types";

const sanitizeJsonArray = (raw: string | undefined) => {
  if (!raw) return [];
  let sanitized = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBracket = sanitized.indexOf("[");
  const lastBracket = sanitized.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    sanitized = sanitized.slice(firstBracket, lastBracket + 1);
  }
  try {
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const parseDetectedItemsFromJson = (raw: string | undefined, sourceId: string): DetectedItem[] => {
  const entries = sanitizeJsonArray(raw);
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry: any, index: number) => {
      const metadata: Record<string, unknown> = {};
      if (entry.amount !== undefined) metadata.amount = entry.amount;
      if (entry.unit !== undefined) metadata.unit = entry.unit;
      if (entry.quantity !== undefined) metadata.quantity = entry.quantity;
      if (entry.nutrients) metadata.nutrients = entry.nutrients;
      if (entry.nutrition) metadata.nutrition = entry.nutrition;
      if (entry.macros) metadata.macros = entry.macros;
      if (entry.calories !== undefined) metadata.calories = entry.calories;
      if (entry.protein !== undefined) metadata.protein = entry.protein;
      if (entry.fat !== undefined) metadata.fat = entry.fat;
      if (entry.carbs !== undefined) metadata.carbs = entry.carbs;
      if (entry.notes) metadata.notes = entry.notes;
      return {
        id: String(entry.id ?? `${sourceId}-${index}`),
        label: String(entry.label ?? entry.name ?? "").trim(),
        category: entry.category ? String(entry.category) : undefined,
        brand: entry.brand ? String(entry.brand) : undefined,
        confidence: typeof entry.confidence === "number" ? entry.confidence : undefined,
        notes: entry.notes ? String(entry.notes) : entry.description ? String(entry.description) : undefined,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      } satisfies DetectedItem;
    })
    .filter((item) => item.label.length > 0);
};
