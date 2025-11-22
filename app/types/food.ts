export type NutrientKeys =
  | "energy_kcal"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "sat_fat_g"
  | "trans_fat_g"
  | "fiber_g"
  | "sugar_g"
  | "sodium_mg";

export type NutrientSet = Record<NutrientKeys, string>;

export type ServingInput = {
  id: string;
  label: string;
  amount: string;
  unit: string;
  nutrients: NutrientSet;
};

export type ServingFromDB = {
  id: string;
  food_id: string;
  label: string;
  amount: number | null;
  unit: string | null;
} & Record<NutrientKeys, number | null>;

export type EditableFood = {
  id: string;
  name: string;
  best_by?: string | null;
  location?: string | null;
  barcode?: string | null;
  cost?: number | null;
  group_id?: string | null;
  group_name?: string | null;
};
