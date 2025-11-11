export type Unit = "g" | "ml" | "pcs";

export type FragmentType =
  | "inventory_list"
  | "recipe"
  | "text"
  | "note";

export type FragmentKindFilter = "foods" | "tools" | "recipes";

export type SortOrder = "name_asc" | "name_desc";

export type Nullable<T> = T | null;
