import {
  defaultUserPrefs,
  type UserPrefs,
  userPrefsSchema,
} from "../models/zodSchemas";
import { queryAsync, runAsync } from "../db/sqlite";
import { repoError } from "./errors";

type PrefRow = {
  user_id: string;
  likes: string | null;
  dislikes: string | null;
  allergies: string | null;
  nutrition_prefs: string | null;
};

const parseJsonArray = (value?: string | null) => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapPrefs = (row: PrefRow): UserPrefs =>
  userPrefsSchema.parse({
    userId: row.user_id,
    likes: parseJsonArray(row.likes),
    dislikes: parseJsonArray(row.dislikes),
    allergies: parseJsonArray(row.allergies),
    nutritionPrefs: parseJsonArray(row.nutrition_prefs),
  });

export const prefsRepo = {
  async getPrefs(userId: string) {
    try {
      const [row] = await queryAsync<PrefRow>(
        "SELECT * FROM user_prefs WHERE user_id = ?",
        [userId]
      );
      return row ? mapPrefs(row) : defaultUserPrefs(userId);
    } catch (error) {
      throw repoError("load prefs", error);
    }
  },

  async setPrefs(userId: string, prefs: UserPrefs) {
    try {
      const payload = userPrefsSchema.parse(prefs);
      await runAsync(
        `INSERT OR REPLACE INTO user_prefs
        (user_id, likes, dislikes, allergies, nutrition_prefs)
        VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          JSON.stringify(payload.likes ?? []),
          JSON.stringify(payload.dislikes ?? []),
          JSON.stringify(payload.allergies ?? []),
          JSON.stringify(payload.nutritionPrefs ?? []),
        ]
      );
      return payload;
    } catch (error) {
      throw repoError("save prefs", error);
    }
  },
};
