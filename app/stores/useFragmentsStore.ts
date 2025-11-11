import { create } from "zustand";
import type { Fragment, FragmentType } from "../models/zodSchemas";
import { fragmentsRepo } from "../repos/fragmentsRepo";
import { flags } from "../utils/flags";
import { createId } from "../utils/id";

type FragmentsState = {
  fragments: Fragment[];
  loading: boolean;
  error: string | null;
  activeType: FragmentType | null;
  load: (type?: FragmentType) => Promise<void>;
  createFragment: (input: {
    title: string;
    type: FragmentType;
    groupId?: string | null;
  }) => Promise<Fragment>;
  updateFragment: (
    id: string,
    patch: Partial<Pick<Fragment, "title" | "notes" | "groupId">>
  ) => Promise<Fragment>;
  removeFragment: (id: string) => Promise<void>;
};

export const useFragmentsStore = create<FragmentsState>((set, get) => ({
  fragments: [],
  loading: false,
  error: null,
  activeType: null,

  load: async (type?: FragmentType) => {
    set({ loading: true, error: null, activeType: type ?? null });
    try {
      const fragments = await fragmentsRepo.listByUser(flags.devUserId, {
        type,
      });
      set({ fragments, loading: false });
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
    }
  },

  createFragment: async ({ title, type, groupId }) => {
    const now = Date.now();
    const fragment: Fragment = {
      id: createId(),
      userId: flags.devUserId,
      groupId: groupId ?? null,
      type,
      title,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };
    const created = await fragmentsRepo.create(fragment);
    set({ fragments: [created, ...get().fragments] });
    return created;
  },

  updateFragment: async (id, patch) => {
    const updated = await fragmentsRepo.update(id, patch);
    set({
      fragments: get().fragments.map((fragment) =>
        fragment.id === id ? updated : fragment
      ),
    });
    return updated;
  },

  removeFragment: async (id) => {
    await fragmentsRepo.remove(id);
    set({ fragments: get().fragments.filter((fragment) => fragment.id !== id) });
  },
}));
