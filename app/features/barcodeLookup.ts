import { DEFAULT_FOOD_IMAGE } from "../constants/images";
import { BARCODE_LIBRARY_GROUP } from "../constants/barcode";
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
  const buildQuery = () =>
    supabase
      .from("foods")
      .select("id,name,best_by,location,barcode,cost,group_id,group_name,image_url")
      .eq("barcode", barcode)
      .order("inserted_at", { ascending: false })
      .limit(1);

  const tryFetch = async (libraryOnly: boolean) => {
    let query = buildQuery();
    if (libraryOnly) {
      query = query.is("group_id", null).eq("group_name", BARCODE_LIBRARY_GROUP);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? null;
  };

  let food = await tryFetch(true);
  if (!food) {
    food = await tryFetch(false);
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
