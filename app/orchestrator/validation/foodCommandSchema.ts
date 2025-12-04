import { z } from "zod";

const nutrientValue = z.union([z.string().min(1), z.number()]).transform((val) => String(val));

const nutrientSchema = z.object({
  energy_kcal: nutrientValue.default("0"),
  protein_g: nutrientValue.default("0"),
  carbs_g: nutrientValue.default("0"),
  fat_g: nutrientValue.default("0"),
  sat_fat_g: nutrientValue.default("0"),
  trans_fat_g: nutrientValue.default("0"),
  fiber_g: nutrientValue.default("0"),
  sugar_g: nutrientValue.default("0"),
  sodium_mg: nutrientValue.default("0"),
});

const servingSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: z.union([z.string().min(1), z.number()]).transform((val) => String(val)),
  unit: z.union([z.string().min(1), z.number()]).transform((val) => String(val)),
  nutrients: nutrientSchema,
});

export const foodCommandSchema = z.object({
  name: z.string().min(1),
  groupId: z.string().uuid(),
  groupName: z.string().optional(),
  bestBy: z.string().optional(),
  location: z.string().optional(),
  imageUrl: z.string().optional(),
  barcode: z.string().optional(),
  cost: z.union([z.string(), z.number()]).optional(),
  servings: z.array(servingSchema).min(1),
});

export type ValidatedFoodCommand = z.infer<typeof foodCommandSchema>;
