import { z } from "zod";
import type { Unit } from "./types";

export const unitEnum = z.enum(["g", "ml", "pcs"]);

export const userSchema = z.object({
  id: z.string().min(1),
});

export const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number().int(),
});

export const groupMemberSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().default("member"),
});

const fragmentTypeEnum = z.enum(["inventory_list", "recipe", "text", "note"]);

export const fragmentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  groupId: z.string().nullable().optional(),
  type: fragmentTypeEnum,
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const fragmentItemBaseSchema = z.object({
  id: z.string().min(1),
  fragmentId: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  baseQty: z.number().nonnegative(),
  baseUnit: unitEnum,
  displayQty: z.number().positive().nullable().optional(),
  displayUnit: unitEnum.nullable().optional(),
  notes: z.string().nullable().optional(),
});

const withDisplayConsistency = <T extends z.ZodObject<any>>(
  schema: T
) =>
  schema.refine(
    (item) =>
      (!item.displayQty && !item.displayUnit) ||
      (Boolean(item.displayQty) && Boolean(item.displayUnit)),
    {
      message: "Display quantity must include a display unit",
      path: ["displayQty"],
    }
  );

export const fragmentItemSchema = withDisplayConsistency(
  fragmentItemBaseSchema
);

export const fragmentItemInputSchema = withDisplayConsistency(
  fragmentItemBaseSchema.extend({
    id: fragmentItemBaseSchema.shape.id.optional(),
  })
);

export const userPrefsSchema = z.object({
  userId: z.string().min(1),
  likes: z.array(z.string()),
  dislikes: z.array(z.string()),
  allergies: z.array(z.string()),
  nutritionPrefs: z.array(z.string()),
});

export const recipeSchema = z.object({
  id: z.string().min(1),
  fragmentId: z.string().min(1),
  summary: z.string().nullable().optional(),
});

export const recipeStepSchema = z.object({
  id: z.string().min(1),
  recipeId: z.string().min(1),
  idx: z.number().int(),
  text: z.string().min(1),
});

export type User = z.infer<typeof userSchema>;
export type Group = z.infer<typeof groupSchema>;
export type GroupMember = z.infer<typeof groupMemberSchema>;
export type Fragment = z.infer<typeof fragmentSchema>;
export type FragmentItem = z.infer<typeof fragmentItemSchema>;
export type UserPrefs = z.infer<typeof userPrefsSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type FragmentType = z.infer<typeof fragmentTypeEnum>;
export type UnitSchema = z.infer<typeof unitEnum>;

export const defaultUserPrefs = (userId: string): UserPrefs => ({
  userId,
  likes: [],
  dislikes: [],
  allergies: [],
  nutritionPrefs: ["Calories", "Protein"],
});

export const normalizeUnit = (unit: Unit | null | undefined): Unit => {
  const parsed = unit ? unitEnum.parse(unit) : "pcs";
  return parsed;
};
