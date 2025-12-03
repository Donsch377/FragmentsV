import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCameraPermissions, type BarcodeScanningResult, type CameraViewProps } from "expo-camera";
import type { EditableFood, NutrientKeys, NutrientSet, ServingFromDB } from "../types/food";
import type {
  RecipeDatabox,
  RecipeIngredient,
  RecipeNutritionField,
  RecipeStep,
  RecipeStepDataboxValue,
  RecipeStepIngredientUsage,
} from "../types/recipes";
import { useAuth } from "../providers/AuthProvider";
import { fetchAccessibleGroups } from "../utils/groups";
import { supabase } from "../lib/supabaseClient";
import { FoodEntryModal } from "../components/FoodEntryModal";
import { TaskModal } from "../components/TaskModal";

type MessageAction = {
  type: "food" | "recipe" | "task";
  entryId: string;
  label?: string;
};

type Message = {
  id: string;
  role: "user" | "system";
  text: string;
  action?: MessageAction;
};

type CommandType = "help" | "addFood" | "addRecipe" | "addTask" | "logFood" | "ai";

type CommandBlueprint = {
  type: CommandType;
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
};

type TaskModalInitial = ComponentProps<typeof TaskModal>["initialTask"];

const NUTRIENT_KEYS: NutrientKeys[] = [
  "energy_kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "sat_fat_g",
  "trans_fat_g",
  "fiber_g",
  "sugar_g",
  "sodium_mg",
];

type FoodServingInput = {
  id?: string;
  label?: string;
  amount?: string | number;
  unit?: string;
  nutrients?: Partial<Record<NutrientKeys, string | number>>;
};

type FoodCommandPayload = {
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

type FoodScratchpadEntry = {
  id: string;
  name: string;
  bestBy?: string;
  location?: string;
  barcode?: string;
  cost?: string;
  groupId?: string;
  groupName?: string;
  imageUrl?: string;
  catalogId?: string;
  servings: {
    id: string;
    label: string;
    amount: string;
    unit: string;
    nutrients: NutrientSet;
  }[];
  createdAt: string;
};

type FoodModalPayload = {
  food: EditableFood;
  servings: ServingFromDB[];
};

type RecipeCommandPayload = {
  title: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  groupId?: string;
  groupName?: string;
  ingredients?: Partial<RecipeIngredient>[];
  steps?: Partial<RecipeStep>[];
  nutrition?: Partial<RecipeNutritionField>[];
  databoxes?: Partial<RecipeDatabox>[];
};

type RecipeScratchpadEntry = {
  id: string;
  title: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  groupId?: string;
  groupName?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition: RecipeNutritionField[];
  databoxes: RecipeDatabox[];
  createdAt: string;
};

type TaskLinkInput = {
  text?: string;
  pantryId?: string;
  recipeId?: string;
};

type TaskCommandPayload = {
  title: string;
  notes?: string;
  startDate?: string;
  startTime?: string;
  dueDate?: string;
  dueTime?: string;
  groupId?: string;
  groupName?: string;
  assignees?: string[] | string;
  link?: TaskLinkInput;
};

type TaskScratchpadEntry = {
  id: string;
  title: string;
  notes?: string;
  startDate?: string;
  startTime?: string;
  dueDate?: string;
  dueTime?: string;
  groupId?: string;
  groupName?: string;
  link: TaskLinkInput;
  linkTypes: string[];
  assignees: string[];
  createdAt: string;
};

type FoodLogManualInput = {
  name: string;
  imageUrl?: string;
  groupName?: string;
  servingLabel: string;
  servingAmount?: string | number;
  servingUnit?: string;
  nutrients?: Partial<Record<NutrientKeys, string | number>>;
};

type FoodLogCommandPayload = {
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

const actionKey = (action: MessageAction) => `${action.type}-${action.entryId}`;

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyNutrients = (): NutrientSet =>
  NUTRIENT_KEYS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: "",
    }),
    {} as NutrientSet,
  );

const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  return trimmed.length ? trimmed : undefined;
};

const coalesceString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const normalized = toOptionalString(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }
  return undefined;
};

const todayDateKey = () => new Date().toISOString().slice(0, 10);

const normalizeLogDate = (value?: string | null) => {
  const trimmed = value?.trim();
  if (trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return todayDateKey();
};

const ensureNutrients = (source?: Partial<Record<NutrientKeys, string | number>>): NutrientSet => {
  const base = emptyNutrients();
  NUTRIENT_KEYS.forEach((key) => {
    const raw = source?.[key];
    base[key] = raw === undefined || raw === null ? "" : String(raw);
  });
  return base;
};

const sanitizeJsonString = (input: string) =>
  input
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–|—/g, "-");

const parseJsonPayload = <T,>(text: string) => {
  if (!text) {
    return { error: "This command requires a JSON object after the command keyword." };
  }
  try {
    return { data: JSON.parse(text) as T };
  } catch (error) {
    const sanitized = sanitizeJsonString(text);
    if (sanitized !== text) {
      try {
        return { data: JSON.parse(sanitized) as T };
      } catch (innerError) {
        return { error: `Invalid JSON payload: ${(innerError as Error).message}` };
      }
    }
    return { error: `Invalid JSON payload: ${(error as Error).message}` };
  }
};

const normalizeFoodPayload = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    return { error: "Food payload must be a JSON object." };
  }
  const payload = raw as FoodCommandPayload;
  const name = toOptionalString(payload.name);
  if (!name) {
    return { error: "Food payload requires a \"name\" field." };
  }
  const servingsInput = Array.isArray(payload.servings) ? payload.servings : [];
  if (!servingsInput.length) {
    return { error: "Provide at least one serving in the \"servings\" array." };
  }
  const servings = servingsInput.map((serving, index) => {
    const nutrientSource = (serving?.nutrients ?? (serving as any)?.macros) as Partial<Record<NutrientKeys, string | number>> | undefined;
    return {
      id: toOptionalString(serving?.id) ?? createId("serving"),
      label: coalesceString(serving?.label, (serving as any)?.name) ?? `Serving ${index + 1}`,
      amount: coalesceString(serving?.amount) ?? "1",
      unit: coalesceString(serving?.unit) ?? "unit",
      nutrients: ensureNutrients(nutrientSource),
    };
  });
  const entry: FoodScratchpadEntry = {
    id: createId("food"),
    name,
    bestBy: coalesceString(payload.bestBy, (payload as any).best_by),
    location: coalesceString(payload.location, (payload as any).storage_location),
    barcode: coalesceString(payload.barcode, (payload as any).upc),
    cost: coalesceString(payload.cost, (payload as any).price),
    imageUrl: coalesceString(payload.imageUrl, (payload as any).image_url, payload.photoUrl, (payload as any).photo_url),
    groupId: coalesceString(payload.groupId, (payload as any).group_id),
    groupName: coalesceString(payload.groupName, (payload as any).group_name),
    catalogId: coalesceString(payload.catalogId, (payload as any).catalog_id),
    servings,
    createdAt: new Date().toISOString(),
  };
  return { entry };
};

const normalizeRecipePayload = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    return { error: "Recipe payload must be a JSON object." };
  }
  const payload = raw as RecipeCommandPayload;
  const title = toOptionalString(payload.title);
  if (!title) {
    return { error: "Recipe payload requires a \"title\" field." };
  }
  const ingredients: RecipeIngredient[] = (payload.ingredients ?? []).map((ingredient, index) => ({
    id: toOptionalString(ingredient?.id) ?? createId("ingredient"),
    label: toOptionalString(ingredient?.label) ?? `Ingredient ${index + 1}`,
    amount: toOptionalString(ingredient?.amount) ?? "",
    unit: toOptionalString(ingredient?.unit) ?? "",
    linkedFoodId: toOptionalString((ingredient as any)?.linkedFoodId ?? (ingredient as any)?.linked_food_id) ?? "",
  }));
  const steps: RecipeStep[] = (payload.steps ?? []).map((step, index) => {
    const requires = Array.isArray(step?.requires) ? step.requires.map((req) => String(req)) : [];
    const ingredientUsages: RecipeStepIngredientUsage[] = Array.isArray(step?.ingredientUsages ?? (step as any)?.ingredients)
      ? (step?.ingredientUsages ?? (step as any)?.ingredients).map((usage: Partial<RecipeStepIngredientUsage>) => ({
          ingredientId: toOptionalString((usage as any)?.ingredientId ?? (usage as any)?.ingredient_id) ?? "",
          amount: toOptionalString(usage?.amount) ?? "",
        }))
      : [];
    const databoxValues: RecipeStepDataboxValue[] = Array.isArray(step?.databoxValues ?? (step as any)?.databoxes)
      ? (step?.databoxValues ?? (step as any)?.databoxes).map((value: Partial<RecipeStepDataboxValue>) => ({
          databoxId: toOptionalString((value as any)?.databoxId ?? (value as any)?.databox_id) ?? "",
          value: toOptionalString(value?.value) ?? "",
        }))
      : [];
    return {
      id: toOptionalString(step?.id) ?? createId("step"),
      summary: toOptionalString(step?.summary) ?? `Step ${index + 1}`,
      notes: toOptionalString(step?.notes),
      requires,
      ingredientUsages,
    databoxValues,
  };
});
  const nutrition: RecipeNutritionField[] = (payload.nutrition ?? []).map((field, index) => ({
    id: toOptionalString(field?.id) ?? createId("nutrition"),
    key: (field?.key ?? "calories") as RecipeNutritionField["key"],
    label: coalesceString(field?.label, (field as any)?.name) ?? `Field ${index + 1}`,
    unit: coalesceString(field?.unit) ?? "",
    estimatedValue: coalesceString(field?.estimatedValue, (field as any)?.value) ?? "",
  }));
  const databoxes: RecipeDatabox[] = (payload.databoxes ?? []).map((box, index) => ({
    id: toOptionalString(box?.id) ?? createId("databox"),
    label: coalesceString(box?.label) ?? `Databox ${index + 1}`,
    defaultValue: coalesceString(box?.defaultValue, (box as any).default_value) ?? "0",
    expression: coalesceString(box?.expression, (box as any).formula) ?? "",
  }));

  const entry: RecipeScratchpadEntry = {
    id: createId("recipe"),
    title,
    prepTimeMinutes: Number(coalesceString(payload.prepTimeMinutes, (payload as any).prepTime, (payload as any).prep_time)) || 0,
    cookTimeMinutes: Number(coalesceString(payload.cookTimeMinutes, (payload as any).cookTime, (payload as any).cook_time)) || 0,
    servings: Number(coalesceString(payload.servings, (payload as any).servingsNumber, (payload as any).servings_count)) || 1,
    groupId: coalesceString(payload.groupId, (payload as any).group_id),
    groupName: coalesceString(payload.groupName, (payload as any).group_name),
    ingredients,
    steps,
    nutrition,
    databoxes,
    createdAt: new Date().toISOString(),
  };
  return { entry };
};

const parseAssignees = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toOptionalString(entry))
      .filter(Boolean) as string[];
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeTaskPayload = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    return { error: "Task payload must be a JSON object." };
  }
  const payload = raw as TaskCommandPayload;
  const title = toOptionalString(payload.title);
  if (!title) {
    return { error: "Task payload requires a \"title\" field." };
  }
  const link: TaskLinkInput = {
    text: coalesceString(payload.link?.text, (payload as any).linkText, (payload as any).linked_text),
    pantryId: coalesceString(payload.link?.pantryId, (payload as any).linkedFoodId, (payload as any).linked_food_id),
    recipeId: coalesceString(payload.link?.recipeId, (payload as any).linkedRecipeId, (payload as any).linked_recipe_id),
  };
  const linkTypes = [
    link.text ? "text" : undefined,
    link.pantryId ? "pantry" : undefined,
    link.recipeId ? "recipe" : undefined,
  ].filter(Boolean) as string[];
  const entry: TaskScratchpadEntry = {
    id: createId("task"),
    title,
    notes: coalesceString(payload.notes, (payload as any).details),
    startDate: coalesceString(payload.startDate, (payload as any).start_date),
    startTime: coalesceString(payload.startTime, (payload as any).start_at),
    dueDate: coalesceString(payload.dueDate, (payload as any).due_date),
    dueTime: coalesceString(payload.dueTime, (payload as any).due_at),
    groupId: coalesceString(payload.groupId, (payload as any).group_id),
    groupName: coalesceString(payload.groupName, (payload as any).group_name),
    link,
    linkTypes,
    assignees: parseAssignees(payload.assignees ?? (payload as any).assignee_names),
    createdAt: new Date().toISOString(),
  };
  return { entry };
};

const parseNullableNumber = (value: string | number | undefined): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = value.trim().replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseQuantityValue = (value?: string | number) => {
  const numeric = parseNullableNumber(
    typeof value === "string" || typeof value === "number" ? (value as string | number) : undefined,
  );
  if (numeric === null || numeric <= 0) {
    return 1;
  }
  return numeric;
};

const convertNutrientsToNumbers = (source?: Partial<Record<NutrientKeys, string | number>>) => {
  const result: Partial<Record<NutrientKeys, number | null>> = {};
  NUTRIENT_KEYS.forEach((key) => {
    result[key] = parseNullableNumber(source?.[key] as any);
  });
  return result;
};

const splitCommands = (input: string): string[] => {
  const trimmed = input.trim();
  if (!trimmed.length) return [];
  const commands: string[] = [];
  let current = "";
  let inQuotes = false;
  let escape = false;
  let depth = 0;

  const flush = () => {
    const text = current.trim();
    if (text.length) {
      commands.push(text);
    }
    current = "";
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : "";
    const isCommandStart = ch === "/" && !inQuotes && depth === 0 && (i === 0 || /\s/.test(prev));
    if (isCommandStart && current.trim().length) {
      flush();
    }

    current += ch;

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) {
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}" && depth > 0) {
        depth -= 1;
      }
    }
  }
  flush();
  return commands.length ? commands : [trimmed];
};

const convertFoodEntryToModalPayload = (entry: FoodScratchpadEntry): FoodModalPayload => ({
  food: {
    id: entry.id,
    name: entry.name,
    best_by: entry.bestBy ?? null,
    location: entry.location ?? null,
    barcode: entry.barcode ?? null,
    cost: parseNullableNumber(entry.cost ?? undefined),
    group_id: entry.groupId ?? null,
    group_name: entry.groupName ?? null,
    image_url: entry.imageUrl ?? null,
    catalog_id: entry.catalogId ?? null,
  },
  servings: entry.servings.map((serving) => ({
    id: serving.id,
    food_id: entry.id,
    label: serving.label,
    amount: parseNullableNumber(serving.amount),
    unit: serving.unit,
    energy_kcal: parseNullableNumber(serving.nutrients.energy_kcal),
    protein_g: parseNullableNumber(serving.nutrients.protein_g),
    carbs_g: parseNullableNumber(serving.nutrients.carbs_g),
    fat_g: parseNullableNumber(serving.nutrients.fat_g),
    sat_fat_g: parseNullableNumber(serving.nutrients.sat_fat_g),
    trans_fat_g: parseNullableNumber(serving.nutrients.trans_fat_g),
    fiber_g: parseNullableNumber(serving.nutrients.fiber_g),
    sugar_g: parseNullableNumber(serving.nutrients.sugar_g),
    sodium_mg: parseNullableNumber(serving.nutrients.sodium_mg),
  })),
});

const convertTaskEntryToDraft = (entry: TaskScratchpadEntry): NonNullable<TaskModalInitial> => ({
  title: entry.title,
  notes: entry.notes,
  startDate: entry.startDate,
  startTime: entry.startTime,
  dueDate: entry.dueDate,
  dueTime: entry.dueTime,
  groupId: entry.groupId ?? null,
  link: entry.link,
  assignees: entry.assignees,
});

const convertRecipeEntryToDraft = (entry: RecipeScratchpadEntry) => ({
  title: entry.title,
  prepTimeMinutes: entry.prepTimeMinutes,
  cookTimeMinutes: entry.cookTimeMinutes,
  servings: entry.servings,
  groupId: entry.groupId ?? null,
  ingredients: entry.ingredients,
  steps: entry.steps,
  nutrition: entry.nutrition,
  databoxes: entry.databoxes,
});

const FOOD_COMMAND_TEMPLATE = `/add food {
  "name": "REQUIRED — string",
  "bestBy": "OPTIONAL — YYYY-MM-DD",
  "location": "OPTIONAL — string",
  "barcode": "OPTIONAL — string",
  "cost": "OPTIONAL — number as string",
  "groupId": "REQUIRED — UUID from accessible groups",
  "groupName": "OPTIONAL — display name for that group",
  "catalogId": "OPTIONAL — catalog reference",
  "imageUrl": "OPTIONAL — image URL",
  "servings": [
    {
      "id": "REQUIRED — unique string",
      "label": "REQUIRED — display name",
      "amount": "REQUIRED — number as string",
      "unit": "REQUIRED — string",
      "nutrients": {
        "energy_kcal": "REQUIRED — number as string",
        "protein_g": "REQUIRED — number as string",
        "carbs_g": "REQUIRED — number as string",
        "fat_g": "REQUIRED — number as string",
        "sat_fat_g": "REQUIRED — number as string",
        "trans_fat_g": "REQUIRED — number as string",
        "fiber_g": "REQUIRED — number as string",
        "sugar_g": "REQUIRED — number as string",
        "sodium_mg": "REQUIRED — number as string"
      }
    }
  ]
}`;

const RECIPE_COMMAND_TEMPLATE = `/add recipe {
  "title": "REQUIRED — string",
  "prepTimeMinutes": "OPTIONAL — number",
  "cookTimeMinutes": "OPTIONAL — number",
  "servings": "OPTIONAL — number",
  "groupId": "REQUIRED — UUID from accessible groups",
  "groupName": "OPTIONAL — display label",
  "ingredients": [
    {
      "id": "REQUIRED — unique string",
      "label": "REQUIRED — ingredient name",
      "amount": "OPTIONAL — string",
      "unit": "OPTIONAL — string",
      "linkedFoodId": "OPTIONAL — pantry id"
    }
  ],
  "steps": [
    {
      "id": "REQUIRED — unique string",
      "summary": "REQUIRED — step description",
      "notes": "OPTIONAL — string",
      "requires": ["OPTIONAL — preceding step ids"],
      "ingredientUsages": [
        { "ingredientId": "REQUIRED", "amount": "OPTIONAL" }
      ],
      "databoxValues": [
        { "databoxId": "REQUIRED", "value": "OPTIONAL expression" }
      ]
    }
  ],
  "nutrition": [
    { "id": "REQUIRED", "key": "REQUIRED", "label": "REQUIRED", "unit": "REQUIRED", "estimatedValue": "REQUIRED" }
  ],
  "databoxes": [
    { "id": "REQUIRED", "label": "REQUIRED", "defaultValue": "REQUIRED", "expression": "OPTIONAL formula" }
  ]
}`;

const TASK_COMMAND_TEMPLATE = `/add task {
  "title": "REQUIRED — string",
  "notes": "OPTIONAL — string",
  "startDate": "OPTIONAL — YYYY-MM-DD",
  "startTime": "OPTIONAL — HH:MM",
  "dueDate": "OPTIONAL — YYYY-MM-DD",
  "dueTime": "OPTIONAL — HH:MM",
  "groupId": "REQUIRED — UUID from accessible groups",
  "groupName": "OPTIONAL — display label",
  "link": {
    "text": "OPTIONAL — freeform context",
    "pantryId": "OPTIONAL — pantry id",
    "recipeId": "OPTIONAL — recipe id"
  },
  "assignees": ["OPTIONAL — list of display names"]
}`;

const FOOD_LOG_COMMAND_TEMPLATE = `/log food {
  "mode": "existing | manual",
  "groupId": "OPTIONAL — defaults to the pantry group when mode=existing",
  "groupName": "OPTIONAL — label for the group",
  "loggedDate": "OPTIONAL — YYYY-MM-DD (defaults to today)",
  "quantity": "OPTIONAL — number or string (defaults to 1)",
  "notes": "OPTIONAL — string",
  "foodId": "REQUIRED when mode=existing — pantry food UUID",
  "servingId": "OPTIONAL when mode=existing — pantry serving UUID",
  "manual": {
    "name": "REQUIRED when mode=manual",
    "imageUrl": "OPTIONAL",
    "groupName": "OPTIONAL — overrides top-level groupName",
    "servingLabel": "REQUIRED when mode=manual",
    "servingAmount": "OPTIONAL — number or string",
    "servingUnit": "OPTIONAL",
    "nutrients": {
      "energy_kcal": "OPTIONAL string or number",
      "protein_g": "... other nutrient keys ...",
      "carbs_g": "",
      "fat_g": "",
      "sat_fat_g": "",
      "trans_fat_g": "",
      "fiber_g": "",
      "sugar_g": "",
      "sodium_mg": ""
    }
  }
}`;

const GENERAL_RULE_LINES = [
  "Fragments AI Command Rules (v2)",
  "",
  "General",
  "• Every /add command must be followed by exactly one valid JSON object.",
  "• NEVER use smart / curly quotes. Use only plain ASCII double quotes: \".",
  "• Bad: “name”",
  "• Good: \"name\"",
  "• Do not add comments inside the JSON.",
  "• Do not include trailing commas.",
  "• If you don’t know a value for an optional field, omit the field entirely instead of using an empty string.",
  "• All numbers must be sent as strings (for example \"140\", not 140), unless otherwise specified.",
];

const COMMAND_RULES: Record<CommandType, string> = {
  help: [
    "/help (alias /commands)",
    "• Returns a concise summary of every slash command.",
    "• Use whenever you need a refresher during a conversation.",
  ].join("\n"),
  addFood: [
    "/add food",
    "",
    "Immediately after /add food output only a JSON object with this shape:",
    FOOD_COMMAND_TEMPLATE,
    "Rules for /add food:",
    "• name and groupId are always required.",
    "• servings must contain at least one serving object.",
    "• id should be a stable unique ID for that serving in the context of this item (e.g. \"coke-12oz-1\").",
    "• If a value is unknown for bestBy, location, barcode, cost, groupName, catalogId, or imageUrl, simply omit that key from the JSON.",
    "• All nutrient values are strings representing numbers (e.g. \"0\", \"39\", \"140\").",
    "",
    "Output format example (valid):",
    "",
    "/add food {",
    '  "name": "Coca-Cola (Can)",',
    '  "bestBy": "2026-12-31",',
    '  "location": "Pantry",',
    '  "barcode": "04963406",',
    '  "cost": "0.75",',
    '  "groupId": "2f4a1ca4-fbcf-4091-8cd5-5d6ec8e5fa66",',
    '  "groupName": "Solo",',
    '  "servings": [',
    "    {",
    '      "id": "coke-12oz-1",',
    '      "label": "1 can (12 fl oz)",',
    '      "amount": "355",',
    '      "unit": "ml",',
    '      "nutrients": {',
    '        "energy_kcal": "140",',
    '        "protein_g": "0",',
    '        "carbs_g": "39",',
    '        "fat_g": "0",',
    '        "sat_fat_g": "0",',
    '        "trans_fat_g": "0",',
    '        "fiber_g": "0",',
    '        "sugar_g": "39",',
    '        "sodium_mg": "45"',
    "      }",
    "    }",
    "  ]",
    "}",
    "",
    "• No explanations before or after.",
    "• No backticks in the actual command the system will parse.",
    "• Only the /add food prefix followed by that single JSON object.",
  ].join("\n"),
  addRecipe: [
    "/add recipe",
    "",
    "Immediately after /add recipe output only a JSON object with this structure:",
    RECIPE_COMMAND_TEMPLATE,
    "Rules for /add recipe:",
    "• title and groupId are required.",
    "• Every ingredient/step/nutrition/databox entry must include its id so the builder can match references.",
    "• requires must list prior step ids whenever sequencing matters.",
    "• databox expressions should mirror the manual form and can reference other databox ids.",
  ].join("\n"),
  addTask: [
    "/add task",
    "",
    "Immediately after /add task output only a JSON object with this structure:",
    TASK_COMMAND_TEMPLATE,
    "Rules for /add task:",
    "• title and groupId are required.",
    "• link can include any combination of text, pantryId, and recipeId.",
    "• assignees accepts an array of display names; omit the key if nobody is assigned yet.",
  ].join("\n"),
  logFood: [
    "/log food",
    "",
    "Immediately after /log food output only a JSON object with this structure:",
    FOOD_LOG_COMMAND_TEMPLATE,
    "Rules for /log food:",
    "• Set mode to \"existing\" when logging a pantry item by ID; include foodId and (optionally) servingId.",
    "• Set mode to \"manual\" when no pantry item exists; include manual.name and manual.servingLabel plus any nutrient data you have.",
    "• quantity defaults to 1 if omitted. Use decimal strings (\"0.5\") when needed.",
    "• loggedDate defaults to today if omitted.",
    "• groupId is optional. When mode=existing and you omit it, the pantry item’s group is used automatically.",
    "• If you don’t know a nutrient value, omit that field under manual.nutrients entirely.",
  ].join("\n"),
  ai: [
    "/ai",
    "• Outputs these rules verbatim and copies them to the clipboard so another AI can read them.",
    "• Never add extra commentary or pre/post text when sharing.",
    "• Remind copilots that commands can be chained by sending one slash command per line.",
  ].join("\n"),
};

const COMMAND_BLUEPRINTS: CommandBlueprint[] = [
  {
    type: "help",
    name: "/help",
    aliases: ["/commands"],
    usage: "/help",
    description: "Lists every command plus its usage string.",
  },
  {
    type: "addFood",
    name: "/add food",
    usage: FOOD_COMMAND_TEMPLATE,
    description: "Structured JSON covering barcode, catalog links, group assignment, and every nutrient per serving.",
  },
  {
    type: "addRecipe",
    name: "/add recipe",
    usage: RECIPE_COMMAND_TEMPLATE,
    description: "JSON lets you populate ingredients, steps, dependencies, nutrition, databox expressions, and group assignment.",
  },
  {
    type: "addTask",
    name: "/add task",
    usage: TASK_COMMAND_TEMPLATE,
    description: "JSON captures start/due windows, links, assignees, and group information for review.",
  },
  {
    type: "logFood",
    name: "/log food",
    usage: FOOD_LOG_COMMAND_TEMPLATE,
    description: "Logs today’s eating via pantry linkage or manual macro entry.",
  },
  {
    type: "ai",
    name: "/ai",
    usage: "/ai",
    description: "Prints the full rulebook and copies it to the clipboard for other copilots.",
  },
];

const buildRulesPrompt = (groupLines: string[]) => {
  const sections = [
    ...GENERAL_RULE_LINES,
    "",
    COMMAND_RULES.help,
    "",
    COMMAND_RULES.addFood,
    "",
    COMMAND_RULES.addRecipe,
    "",
    COMMAND_RULES.addTask,
    "",
    COMMAND_RULES.logFood,
    "",
    COMMAND_RULES.ai,
    "",
    "Multi-command guidance",
    "- Send commands one per line or in separate messages. Each line must start with the slash keyword.",
    "- Example:",
    "  /add food {...}",
    "  /add task {...}",
    "- The assistant executes the commands sequentially and reports results after each one.",
    "",
    "Accessible groups",
    ...groupLines,
  ];
  return sections.join("\n");
};

const createMessage = (text: string, role: Message["role"], action?: MessageAction): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  action,
});

const createSystemMessage = (text: string, action?: MessageAction) => createMessage(text, "system", action);

const INITIAL_MESSAGE = createSystemMessage(
  "Welcome to the Fragments AI console. Run /help to see the JSON-based slash commands."
);

const formatMeta = (values: (string | undefined)[]) => values.filter(Boolean).join(" • ");

export const AiChatScreen = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [foods, setFoods] = useState<FoodScratchpadEntry[]>([]);
  const [recipes, setRecipes] = useState<RecipeScratchpadEntry[]>([]);
  const [tasks, setTasks] = useState<TaskScratchpadEntry[]>([]);
  const [groupOptions, setGroupOptions] = useState<{ id: string; name: string }[]>([]);
  const [foodModalPayload, setFoodModalPayload] = useState<FoodModalPayload | null>(null);
  const [foodModalVisible, setFoodModalVisible] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskModalInitial>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [actionStatuses, setActionStatuses] = useState<Record<string, boolean>>({});
  const activeActionRef = useRef<MessageAction | null>(null);
  const cameraModuleRef = useRef<typeof import("expo-camera") | null>(null);
  const [scannerComponent, setScannerComponent] = useState<ComponentType<CameraViewProps> | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const scannerLockRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const markActionComplete = useCallback((action: MessageAction) => {
    setActionStatuses((prev) => ({
      ...prev,
      [actionKey(action)]: true,
    }));
  }, []);

  const ensureCameraModule = useCallback(async () => {
    if (cameraModuleRef.current) {
      return cameraModuleRef.current;
    }
    try {
      const module = await import("expo-camera");
      cameraModuleRef.current = module;
      return module;
    } catch (error) {
      console.warn("Camera module unavailable:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setGroupOptions([]);
      return;
    }
    let cancelled = false;
    const loadGroups = async () => {
      try {
        const groups = await fetchAccessibleGroups(session.user.id);
        if (!cancelled) {
          setGroupOptions(groups);
        }
      } catch (error) {
        console.error("Failed to load groups for AI chat", error);
      }
    };
    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const groupLines = useMemo(
    () =>
      groupOptions.length
        ? groupOptions.map((group) => `- ${group.name} (${group.id})`)
        : ["- No accessible groups detected. Provide null for groupId until one exists."],
    [groupOptions],
  );

  const addFoodEntry = useCallback((entry: FoodScratchpadEntry) => {
    setFoods((prev) => [entry, ...prev]);
  }, []);

  const addRecipeEntry = useCallback((entry: RecipeScratchpadEntry) => {
    setRecipes((prev) => [entry, ...prev]);
  }, []);

  const addTaskEntry = useCallback((entry: TaskScratchpadEntry) => {
    setTasks((prev) => [entry, ...prev]);
  }, []);

  const commandSummary = useMemo(() => buildRulesPrompt(groupLines), [groupLines]);

  const handleFoodModalClose = useCallback(() => {
    setFoodModalVisible(false);
    setFoodModalPayload(null);
    activeActionRef.current = null;
  }, []);

  const handleFoodModalSaved = useCallback(() => {
    if (activeActionRef.current?.type === "food") {
      markActionComplete(activeActionRef.current);
    }
    handleFoodModalClose();
  }, [handleFoodModalClose, markActionComplete]);

  const handleTaskModalClose = useCallback(() => {
    setTaskModalVisible(false);
    setTaskDraft(null);
    activeActionRef.current = null;
  }, []);

  const handleTaskModalSaved = useCallback(() => {
    if (activeActionRef.current?.type === "task") {
      markActionComplete(activeActionRef.current);
    }
    handleTaskModalClose();
  }, [handleTaskModalClose, markActionComplete]);

  const handleCloseScanner = useCallback(() => {
    setScannerVisible(false);
    setScannerComponent(null);
    scannerLockRef.current = false;
  }, []);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!scannerVisible || scannerLockRef.current) return;
      scannerLockRef.current = true;
      const scanned = result.data?.trim();
      if (scanned) {
        setInput((prev) => {
          const normalized = prev.trim();
          return normalized.length ? `${normalized} ${scanned}` : scanned;
        });
      }
      handleCloseScanner();
    },
    [handleCloseScanner, scannerVisible],
  );

  const handleOpenScanner = useCallback(async () => {
    try {
      const module = await ensureCameraModule();
      if (!module) {
        Alert.alert("Scanner unavailable", "Unable to load the camera module on this device.");
        return;
      }
      if (!cameraPermission?.granted) {
        const permissionResult = await requestCameraPermission?.();
        if (!permissionResult?.granted) {
          Alert.alert("Camera permission needed", "Enable camera access to scan barcodes.");
          return;
        }
      }
      setScannerComponent(() => module.CameraView);
      scannerLockRef.current = false;
      setScannerVisible(true);
    } catch (error) {
      console.error("Unable to open scanner", error);
      Alert.alert("Scanner error", "Unable to launch the barcode scanner right now.");
    }
  }, [cameraPermission?.granted, ensureCameraModule, requestCameraPermission]);

  const handleLogFoodCommand = useCallback(
    async (raw: FoodLogCommandPayload): Promise<Message> => {
      if (!session?.user?.id) {
        return createSystemMessage("Sign in required before logging meals.");
      }
      const mode: "existing" | "manual" = raw.mode === "manual" ? "manual" : "existing";
      const quantity = parseQuantityValue(raw.quantity);
      const loggedDate = normalizeLogDate(coalesceString(raw.loggedDate));
      const notes = coalesceString(raw.notes);
      const overrideGroupId = coalesceString(raw.groupId);
      const overrideGroupName = coalesceString(raw.groupName);

      try {
        if (mode === "existing") {
          const foodId = coalesceString(raw.foodId);
          if (!foodId) {
            return createSystemMessage("Provide \"foodId\" when mode is set to \"existing\".");
          }
          const servingId = coalesceString(raw.servingId);
          const { data, error } = await supabase
            .from("foods")
            .select("id, name, image_url, group_id, group_name, servings:food_servings(*)")
            .eq("id", foodId)
            .maybeSingle();
          if (error) {
            console.error("AI log lookup error", error);
            return createSystemMessage("Unable to look up that pantry item right now.");
          }
          if (!data) {
            return createSystemMessage("No pantry item was found with that foodId.");
          }
          const servings = (data as any)?.servings ?? [];
          let serving: ServingFromDB | null = null;
          if (servingId) {
            serving = servings.find((item: ServingFromDB) => item.id === servingId) ?? null;
            if (!serving) {
              return createSystemMessage("That servingId does not belong to the specified pantry item.");
            }
          } else if (servings.length) {
            serving = servings[0];
          }
          const insertPayload: Record<string, any> = {
            food_id: data.id,
            serving_id: serving?.id ?? null,
            group_id: overrideGroupId ?? coalesceString((data as any).group_id) ?? null,
            quantity,
            logged_date: loggedDate,
            notes,
            food_name: data.name ?? null,
            food_image_url: (data as any).image_url ?? null,
            food_group_name: overrideGroupName ?? coalesceString((data as any).group_name) ?? null,
            serving_label: serving?.label ?? null,
            serving_amount: serving?.amount ?? null,
            serving_unit: serving?.unit ?? null,
          };
          NUTRIENT_KEYS.forEach((key) => {
            insertPayload[key] = serving?.[key] ?? null;
          });
          const { error: insertError } = await supabase.from("food_logs").insert(insertPayload);
          if (insertError) {
            console.error("AI log insert error", insertError);
            return createSystemMessage("Unable to log that item. Please try again.");
          }
          return createSystemMessage(`Logged ${quantity} × ${data.name ?? "Food item"} for ${loggedDate}.`);
        }

        const manual = raw.manual;
        if (!manual) {
          return createSystemMessage("Manual mode requires a \"manual\" object with name and servingLabel.");
        }
        const manualName = coalesceString(manual.name);
        if (!manualName) {
          return createSystemMessage("Manual payload requires \"manual.name\".");
        }
        const servingLabel = coalesceString(manual.servingLabel);
        if (!servingLabel) {
          return createSystemMessage("Manual payload requires \"manual.servingLabel\".");
        }
        const manualNutrients = convertNutrientsToNumbers(manual.nutrients);
        const insertPayload: Record<string, any> = {
          food_id: null,
          serving_id: null,
          group_id: overrideGroupId ?? null,
          quantity,
          logged_date: loggedDate,
          notes,
          food_name: manualName,
          food_image_url: coalesceString(manual.imageUrl),
          food_group_name: coalesceString(manual.groupName) ?? overrideGroupName ?? null,
          serving_label: servingLabel,
          serving_amount: parseNullableNumber(manual.servingAmount as any),
          serving_unit: coalesceString(manual.servingUnit),
        };
        NUTRIENT_KEYS.forEach((key) => {
          insertPayload[key] = manualNutrients[key] ?? null;
        });
        const { error: insertError } = await supabase.from("food_logs").insert(insertPayload);
        if (insertError) {
          console.error("AI manual log insert error", insertError);
          return createSystemMessage("Unable to log that item. Please try again.");
        }
        return createSystemMessage(`Logged ${quantity} × ${manualName} for ${loggedDate}.`);
      } catch (error) {
        console.error("Failed to log food via AI command", error);
        return createSystemMessage("Unable to log food right now. Check your connection and try again.");
      }
    },
    [session?.user?.id],
  );

  const processCommand = useCallback(
    async (rawInput: string): Promise<Message[]> => {
      const trimmed = rawInput.trim();
      if (!trimmed) {
        return [];
      }

      const lower = trimmed.toLowerCase();
      let matchedCommand: CommandBlueprint | null = null;
      let matchedTrigger: string | null = null;

      for (const command of COMMAND_BLUEPRINTS) {
        const triggers = [command.name, ...(command.aliases ?? [])];
        for (const trigger of triggers) {
          const normalizedTrigger = trigger.toLowerCase();
          if (lower === normalizedTrigger || lower.startsWith(`${normalizedTrigger} `)) {
            matchedCommand = command;
            matchedTrigger = trigger;
            break;
          }
        }
        if (matchedCommand) {
          break;
        }
      }

      if (!matchedCommand || !matchedTrigger) {
        return [createSystemMessage("Unknown command. Type /help to review the valid options.")];
      }

      const payload = trimmed.slice(matchedTrigger.length).trim();

      switch (matchedCommand.type) {
        case "help":
          return [createSystemMessage(commandSummary)];
        case "addFood": {
          const parsed = parseJsonPayload<FoodCommandPayload>(payload);
          if (parsed.error) {
            return [createSystemMessage(parsed.error)];
          }
          const normalized = normalizeFoodPayload(parsed.data);
          if (normalized.error) {
            return [createSystemMessage(normalized.error)];
          }
          const entry = normalized.entry!;
          addFoodEntry(entry);
          return [
            createSystemMessage(
              `Food captured: ${entry.name} (${entry.servings.length} serving${
                entry.servings.length === 1 ? "" : "s"
              }).`,
              { type: "food", entryId: entry.id, label: "Review & confirm" },
            ),
          ];
        }
        case "addRecipe": {
          const parsed = parseJsonPayload<RecipeCommandPayload>(payload);
          if (parsed.error) {
            return [createSystemMessage(parsed.error)];
          }
          const normalized = normalizeRecipePayload(parsed.data);
          if (normalized.error) {
            return [createSystemMessage(normalized.error)];
          }
          const entry = normalized.entry!;
          addRecipeEntry(entry);
          return [
            createSystemMessage(
              `Recipe captured: ${entry.title} (${entry.steps.length} step${
                entry.steps.length === 1 ? "" : "s"
              }, ${entry.databoxes.length} databoxes).`,
              { type: "recipe", entryId: entry.id, label: "Open recipe creator" },
            ),
          ];
        }
        case "addTask": {
          const parsed = parseJsonPayload<TaskCommandPayload>(payload);
          if (parsed.error) {
            return [createSystemMessage(parsed.error)];
          }
          const normalized = normalizeTaskPayload(parsed.data);
          if (normalized.error) {
            return [createSystemMessage(normalized.error)];
          }
          const entry = normalized.entry!;
          addTaskEntry(entry);
          return [
            createSystemMessage(
              `Task captured: ${entry.title}${
                entry.dueDate ? ` (due ${entry.dueDate})` : ""
              }.`,
              { type: "task", entryId: entry.id, label: "Review & confirm" },
            ),
          ];
        }
        case "logFood": {
          const parsed = parseJsonPayload<FoodLogCommandPayload>(payload);
          if (parsed.error) {
            return [createSystemMessage(parsed.error)];
          }
          const response = await handleLogFoodCommand(parsed.data);
          return [response];
        }
        case "ai": {
          const prompt = buildRulesPrompt(groupLines);
          await Clipboard.setStringAsync(prompt);
          return [createSystemMessage(prompt)];
        }
        default:
          return [createSystemMessage("That command exists but is not implemented yet.")];
      }
    },
    [addFoodEntry, addRecipeEntry, addTaskEntry, commandSummary, groupLines, handleLogFoodCommand],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMessage = createMessage(trimmed, "user");
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const commandSegments = splitCommands(trimmed);
    const aggregatedResponses: Message[] = [];
    for (const segment of commandSegments) {
      const responses = await processCommand(segment);
      if (responses.length) {
        aggregatedResponses.push(...responses);
      }
    }
    if (aggregatedResponses.length) {
      setMessages((prev) => [...prev, ...aggregatedResponses]);
    }
  }, [input, processCommand]);

  const handleActionPress = useCallback(
    (action: MessageAction) => {
      activeActionRef.current = action;
      if (action.type === "food") {
        const entry = foods.find((item) => item.id === action.entryId);
        if (!entry) return;
        const payload = convertFoodEntryToModalPayload(entry);
        setFoodModalPayload(payload);
        setFoodModalVisible(true);
        return;
      }
      if (action.type === "task") {
        const entry = tasks.find((item) => item.id === action.entryId);
        if (!entry) return;
        setTaskDraft(convertTaskEntryToDraft(entry));
        setTaskModalVisible(true);
        return;
      }
      if (action.type === "recipe") {
        const entry = recipes.find((item) => item.id === action.entryId);
        if (!entry) return;
        navigation
          .getParent()
          ?.navigate("RecipeCreator", {
            groupId: entry.groupId ?? null,
            initialRecipe: convertRecipeEntryToDraft(entry),
          });
      }
    },
    [foods, tasks, recipes, navigation],
  );

  const tipHeader = useMemo(
    () => <Text style={styles.tipText}>Use /help if you need the slash commands.</Text>,
    [],
  );
  const Scanner = scannerComponent;

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <View style={styles.chatContainer}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const action = item.action;
              const buttonKey = action ? actionKey(action) : null;
              const isDone = buttonKey ? actionStatuses[buttonKey] : false;
              return (
                <View style={[styles.messageBubble, item.role === "user" ? styles.userBubble : styles.systemBubble]}>
                  <Text style={styles.messageMeta}>{item.role === "user" ? "You" : "System"}</Text>
                  <Text style={styles.messageText}>{item.text}</Text>
                  {action ? (
                    <TouchableOpacity
                      style={[styles.messageAction, isDone && styles.messageActionDone]}
                      onPress={() => handleActionPress(action)}
                    >
                      <Text style={[styles.messageActionText, isDone && styles.messageActionDoneText]}>
                        {isDone ? "Done. Add again?" : action.label ?? "Review & confirm"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            }}
            ListHeaderComponent={tipHeader}
            contentContainerStyle={styles.messageListContent}
            style={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          <View style={[styles.inputRow, { paddingBottom: Math.max(10, insets.bottom + 4) }]}>
            <TouchableOpacity style={styles.inputIconButton} onPress={handleOpenScanner}>
              <Ionicons name="barcode-outline" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message Fragments AI (use /help)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]} onPress={handleSend} disabled={!input.trim()}>
              <Text style={styles.sendLabel}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {Scanner ? (
        <Modal visible={scannerVisible} animationType="fade" transparent onRequestClose={handleCloseScanner} statusBarTranslucent>
          <View style={styles.scannerModal}>
            <View style={styles.scannerCameraWrapper}>
              <Scanner style={styles.scannerCamera} facing="back" onBarcodeScanned={handleBarcodeScanned} />
              <View style={styles.scannerOverlay}>
                <Text style={styles.scannerText}>Align a barcode to paste it into chat.</Text>
                <TouchableOpacity style={styles.scannerCloseButton} onPress={handleCloseScanner}>
                  <Text style={styles.scannerCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <FoodEntryModal
        visible={foodModalVisible}
        onClose={handleFoodModalClose}
        onSaved={handleFoodModalSaved}
        mode="create"
        defaultGroupId={foodModalPayload?.food.group_id ?? null}
        defaultGroupName={foodModalPayload?.food.group_name ?? null}
        initialFood={foodModalPayload?.food ?? null}
        initialServings={foodModalPayload?.servings ?? []}
      />
      <TaskModal
        visible={taskModalVisible}
        onClose={handleTaskModalClose}
        onSaved={handleTaskModalSaved}
        defaultGroupId={taskDraft?.groupId ?? null}
        initialTask={taskDraft}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#050505",
  },
  messageList: {
    flex: 1,
  },
  tipText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginBottom: 16,
  },
  messageBubble: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
    maxWidth: "90%",
  },
  systemBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    maxWidth: "95%",
  },
  messageMeta: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
  },
  messageText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
  },
  messageAction: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  messageActionDone: {
    backgroundColor: "rgba(22,163,74,0.18)",
    borderColor: "rgba(22,163,74,0.3)",
    borderWidth: 1,
  },
  messageActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  messageActionDoneText: {
    color: "#16a34a",
  },
  messageListContent: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingTop: 10,
  },
  inputIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#16a34a",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendLabel: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  scannerModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  scannerCameraWrapper: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: "hidden",
    alignSelf: "center",
    backgroundColor: "#000",
  },
  scannerCamera: {
    ...StyleSheet.absoluteFillObject,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  scannerText: {
    color: "#ffffff",
    fontSize: 14,
    textAlign: "center",
  },
  scannerCloseButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scannerCloseText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
