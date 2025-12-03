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
  image_url?: string | null;
  catalog_id?: string | null;
};

export type FoodLogEntry = {
  id: string;
  food_id: string | null;
  serving_id: string | null;
  group_id: string | null;
  user_id: string | null;
  quantity: number;
  logged_date: string;
  notes?: string | null;
  inserted_at: string;
  food?: EditableFood | null;
  serving?: ServingFromDB | null;
  food_name?: string | null;
  food_image_url?: string | null;
  food_group_name?: string | null;
  serving_label?: string | null;
  serving_amount?: number | null;
  serving_unit?: string | null;
  energy_kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  sat_fat_g?: number | null;
  trans_fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
};
