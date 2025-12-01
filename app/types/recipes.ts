export type RecipeIngredient = {
  id: string;
  label: string;
  amount: string;
  unit: string;
  linkedFoodId?: string | null;
};

export type RecipeStepIngredientUsage = {
  ingredientId: string;
  amount: string;
};

export type RecipeStepDataboxValue = {
  databoxId: string;
  value: string;
};

export type RecipeStep = {
  id: string;
  summary: string;
  notes?: string;
  requires: string[];
  ingredientUsages: RecipeStepIngredientUsage[];
  databoxValues: RecipeStepDataboxValue[];
};

export type RecipeNutritionKey =
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "fiber"
  | "sugar"
  | "sodium";

export type RecipeNutritionField = {
  id: string;
  key: RecipeNutritionKey;
  label: string;
  unit: string;
  estimatedValue: string;
};

export type RecipeDatabox = {
  id: string;
  label: string;
  defaultValue: string;
  expression: string;
};

export type RecipeDefinition = {
  id: string;
  title: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  createdAt: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition: RecipeNutritionField[];
  databoxes: RecipeDatabox[];
};
