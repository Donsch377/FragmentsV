import { create } from "zustand";
import type { FragmentItem } from "../models/zodSchemas";
import type { SortOrder } from "../models/types";
import { inventoryRepo, type FragmentItemInput } from "../repos/inventoryRepo";

type InventoryState = {
  activePantryFragmentId: string | null;
  items: FragmentItem[];
  loading: boolean;
  sort: SortOrder;
  search: string;
  load: (fragmentId: string) => Promise<void>;
  addOrUpdate: (input: FragmentItemInput) => Promise<FragmentItem | null>;
  remove: (id: string) => Promise<void>;
  searchItems: (query: string) => Promise<void>;
  setSort: (sort: SortOrder) => Promise<void>;
};

const defaultSort: SortOrder = "name_asc";

export const useInventoryStore = create<InventoryState>((set, get) => ({
  activePantryFragmentId: null,
  items: [],
  loading: false,
  sort: defaultSort,
  search: "",

  load: async (fragmentId: string) => {
    set({ loading: true, activePantryFragmentId: fragmentId });
    try {
      const { search, sort } = get();
      const items = await inventoryRepo.listItems(fragmentId, { search, sort });
      set({ items, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  addOrUpdate: async (input) => {
    const fragmentId = input.fragmentId ?? get().activePantryFragmentId;
    if (!fragmentId) {
      return null;
    }

    try {
      const saved = await inventoryRepo.upsertItem({
        ...input,
        fragmentId,
      });

      const items = await inventoryRepo.listItems(fragmentId, {
        search: get().search,
        sort: get().sort,
      });

      set({ items, activePantryFragmentId: fragmentId });
      return saved;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  remove: async (id) => {
    try {
      await inventoryRepo.removeItem(id);
      const fragmentId = get().activePantryFragmentId;
      if (fragmentId) {
        const items = await inventoryRepo.listItems(fragmentId, {
          search: get().search,
          sort: get().sort,
        });
        set({ items });
      }
    } catch (error) {
      console.error(error);
    }
  },

  searchItems: async (query) => {
    set({ search: query });
    const fragmentId = get().activePantryFragmentId;
    if (!fragmentId) {
      return;
    }
    try {
      const items = await inventoryRepo.listItems(fragmentId, {
        search: query,
        sort: get().sort,
      });
      set({ items });
    } catch (error) {
      console.error(error);
    }
  },

  setSort: async (sort) => {
    set({ sort });
    const fragmentId = get().activePantryFragmentId;
    if (!fragmentId) {
      return;
    }
    try {
      const items = await inventoryRepo.listItems(fragmentId, {
        search: get().search,
        sort,
      });
      set({ items });
    } catch (error) {
      console.error(error);
    }
  },
}));
