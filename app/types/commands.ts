import type { NutrientKeys } from "./food";

export type FoodServingInput = {
  id?: string;
  label?: string;
  amount?: string | number;
  unit?: string;
  nutrients?: Partial<Record<NutrientKeys, string | number>>;
};

export type FoodCommandPayload = {
  name: string;
  bestBy?: string;
  location?: string;
  barcode?: string;
  cost?: string | number;
  groupId?: string;
  groupName?: string;
  imageUrl?: string;
  photoUrl?: string;
  catalogId?: string;
  servings?: FoodServingInput[];
};

export type FoodLogManualInput = {
  name: string;
  imageUrl?: string;
  groupName?: string;
  servingLabel: string;
  servingAmount?: string | number;
  servingUnit?: string;
  nutrients?: Partial<Record<NutrientKeys, string | number>>;
};

export type FoodLogCommandPayload = {
  mode?: "existing" | "manual";
  foodId?: string;
  servingId?: string;
  groupId?: string;
  groupName?: string;
  loggedDate?: string;
  quantity?: string | number;
  notes?: string;
  manual?: FoodLogManualInput;
};
