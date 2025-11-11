import { create } from "zustand";
import type { UserPrefs } from "../models/zodSchemas";
import { prefsRepo } from "../repos/prefsRepo";
import { flags } from "../utils/flags";

type PrefsState = {
  prefs: UserPrefs | null;
  loading: boolean;
  load: () => Promise<void>;
  save: (prefs: UserPrefs) => Promise<void>;
};

export const usePrefsStore = create<PrefsState>((set) => ({
  prefs: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const prefs = await prefsRepo.getPrefs(flags.devUserId);
      set({ prefs, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  save: async (prefs) => {
    set({ loading: true });
    try {
      const saved = await prefsRepo.setPrefs(flags.devUserId, prefs);
      set({ prefs: saved, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },
}));
