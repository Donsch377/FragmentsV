import { DEFAULT_FOOD_IMAGE } from "../constants/images";
import { supabase } from "../lib/supabaseClient";
import type { ServingFromDB } from "../types/food";

export type SupabaseFoodRow = {
  id: string;
  name: string | null;
  best_by: string | null;
  location: string | null;
  barcode: string | null;
  cost: number | null;
  group_id: string | null;
  group_name: string | null;
  image_url: string | null;
  catalog_id?: string | null;
};

type OpenFoodFactsPayload = {
  product_name: string | null;
  brands: string | null;
  image_url?: string | null;
  image_front_small_url?: string | null;
  image_small_url?: string | null;
  serving_size?: string | null;
  nutriments?: Record<string, number | string | undefined>;
};

export type BarcodeLookupResult =
  | {
      source: "supabase";
      barcode: string;
      food: SupabaseFoodRow;
      servings: ServingFromDB[];
      photoUrl: string;
    }
  | {
      source: "openfoodfacts";
      barcode: string;
      product: {
        name: string | null;
        brand: string | null;
        imageUrl: string | null;
        servingSize: string | null;
        nutriments: Record<string, number | string | undefined>;
      };
      photoUrl: string;
    }
  | {
    source: "none";
    barcode: string;
    photoUrl: string;
  };

export const lookupBarcode = async (rawBarcode: string): Promise<BarcodeLookupResult> => {
  const barcode = rawBarcode.trim();
  if (!barcode) {
    return { source: "none", barcode, photoUrl: DEFAULT_FOOD_IMAGE };
  }

  try {
    const supabaseResult = await fetchFoodFromSupabase(barcode);
    if (supabaseResult) {
      const { food, servings } = supabaseResult;
      return {
        source: "supabase",
        barcode,
        food,
        servings,
        photoUrl: food.image_url || DEFAULT_FOOD_IMAGE,
      };
    }

    const openFoodFactsResult = await fetchFromOpenFoodFacts(barcode);
    if (openFoodFactsResult) {
      return {
        source: "openfoodfacts",
        barcode,
        product: openFoodFactsResult,
        photoUrl: openFoodFactsResult.imageUrl || DEFAULT_FOOD_IMAGE,
      };
    }
  } catch (error) {
    console.warn("Barcode lookup failed:", error);
  }

  return { source: "none", barcode, photoUrl: DEFAULT_FOOD_IMAGE };
};

const fetchFoodFromSupabase = async (
  barcode: string,
): Promise<{ food: SupabaseFoodRow; servings: ServingFromDB[] } | null> => {
  const catalogResult = await fetchCatalogEntry(barcode);
  if (catalogResult) {
    return catalogResult;
  }

  const { data: food, error } = await supabase
    .from("foods")
    .select("id,name,best_by,location,barcode,cost,group_id,group_name,image_url,catalog_id")
    .eq("barcode", barcode)
    .order("inserted_at", { ascending: false })
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!food) {
    return null;
  }

  const { data: servings, error: servingsError } = await supabase
    .from("food_servings")
    .select("*")
    .eq("food_id", food.id);

  if (servingsError) {
    throw servingsError;
  }

  return { food, servings: servings ?? [] };
};

const fetchCatalogEntry = async (
  barcode: string,
): Promise<{ food: SupabaseFoodRow; servings: ServingFromDB[] } | null> => {
  const { data, error } = await supabase
    .from("food_catalog")
    .select("id,name,barcode,image_url")
    .eq("barcode", barcode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: catalogServings, error: servingError } = await supabase
    .from("food_catalog_servings")
    .select("*")
    .eq("catalog_id", data.id);

  if (servingError) {
    throw servingError;
  }

  const servings: ServingFromDB[] = (catalogServings ?? []).map((row: any) => ({
    id: row.id,
    food_id: data.id,
    label: row.label,
    amount: row.amount,
    unit: row.unit,
    energy_kcal: row.energy_kcal,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    sat_fat_g: row.sat_fat_g,
    trans_fat_g: row.trans_fat_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    sodium_mg: row.sodium_mg,
  }));

  const food: SupabaseFoodRow = {
    id: data.id,
    name: data.name,
    barcode: data.barcode,
    best_by: null,
    location: null,
    cost: null,
    group_id: null,
    group_name: "Catalog",
    image_url: data.image_url,
    catalog_id: data.id,
  };

  return { food, servings };
};

const fetchFromOpenFoodFacts = async (
  barcode: string,
): Promise<{
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  servingSize: string | null;
  nutriments: Record<string, number | string | undefined>;
} | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (payload.status !== 1 || !payload.product) {
      return null;
    }

    const product: OpenFoodFactsPayload = payload.product;
    const imageUrl =
      product.image_url ?? product.image_front_small_url ?? product.image_small_url ?? null;

    return {
      name: product.product_name ?? null,
      brand: product.brands ?? null,
      imageUrl,
      servingSize: product.serving_size ?? null,
      nutriments: product.nutriments ?? {},
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
