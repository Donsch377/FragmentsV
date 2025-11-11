import AsyncStorage from "@react-native-async-storage/async-storage";
import { flags } from "../utils/flags";
import { getDB } from "./sqlite";

const SEED_FLAG_KEY = "fragments_seed_v1";

const TABLES = [
  "recipe_steps",
  "recipes",
  "fragment_items",
  "fragments",
  "group_members",
  "groups",
  "user_prefs",
  "users",
];

export const ensureSeedData = async () => {
  const alreadySeeded = await AsyncStorage.getItem(SEED_FLAG_KEY);
  if (alreadySeeded) {
    return;
  }

  await seedDatabase();
  await AsyncStorage.setItem(SEED_FLAG_KEY, "1");
};

export const seedDatabase = async () => {
  const db = getDB();
  const userId = flags.devUserId;
  const groupId = "home-kitchen";
  const pantryFragmentId = "fragment-pantry";
  const notesFragmentId = "fragment-store-ad";
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT OR IGNORE INTO users (id) VALUES (?);`, [userId]);

    await db.runAsync(
      `INSERT OR REPLACE INTO groups (id, name, created_at) VALUES (?, ?, ?);`,
      [groupId, "Home Kitchen", now]
    );

    await db.runAsync(
      `INSERT OR REPLACE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?);`,
      [groupId, userId, "owner"]
    );

    await db.runAsync(
      `INSERT OR REPLACE INTO fragments (id, user_id, group_id, type, title, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        pantryFragmentId,
        userId,
        groupId,
        "inventory_list",
        "Pantry",
        null,
        now,
        now,
      ]
    );

    await db.runAsync(
      `INSERT OR REPLACE INTO fragments (id, user_id, group_id, type, title, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        notesFragmentId,
        userId,
        null,
        "text",
        "Store Ad Drop",
        "Weekly store ad highlights to revisit later.",
        now,
        now,
      ]
    );

    const sampleItems = [
      {
        id: "item-oats",
        name: "Oats",
        brand: "Bulk Goodness",
        barcode: null,
        baseQty: 500,
        baseUnit: "g",
        displayQty: 2,
        displayUnit: "pcs",
        notes: "Roughly two cups remaining.",
      },
      {
        id: "item-eggs",
        name: "Eggs",
        brand: null,
        barcode: null,
        baseQty: 12,
        baseUnit: "pcs",
        displayQty: 12,
        displayUnit: "pcs",
        notes: "Carton",
      },
      {
        id: "item-milk",
        name: "Milk 2%",
        brand: "Local Dairy",
        barcode: null,
        baseQty: 1000,
        baseUnit: "ml",
        displayQty: 1,
        displayUnit: "pcs",
        notes: "One quart",
      },
      {
        id: "item-bread",
        name: "Bread",
        brand: "Brand X",
        barcode: null,
        baseQty: 1,
        baseUnit: "pcs",
        displayQty: 1,
        displayUnit: "pcs",
        notes: "Whole loaf",
      },
      {
        id: "item-pasta",
        name: "Pasta",
        brand: "Dry Pantry",
        barcode: "1234567890123",
        baseQty: 454,
        baseUnit: "g",
        displayQty: 1,
        displayUnit: "pcs",
        notes: "Includes barcode for hybrid identity",
      },
    ];

    for (const item of sampleItems) {
      await db.runAsync(
        `INSERT OR REPLACE INTO fragment_items
        (id, fragment_id, name, brand, barcode, base_qty, base_unit, display_qty, display_unit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          item.id,
          pantryFragmentId,
          item.name,
          item.brand,
          item.barcode,
          item.baseQty,
          item.baseUnit,
          item.displayQty,
          item.displayUnit,
          item.notes,
        ]
      );
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO user_prefs
      (user_id, likes, dislikes, allergies, nutrition_prefs)
      VALUES (?, ?, ?, ?, ?);`,
      [
        userId,
        JSON.stringify(["Oats", "Chocolate"]),
        JSON.stringify(["Okra"]),
        JSON.stringify(["Peanuts"]),
        JSON.stringify(["Calories", "Protein"]),
      ]
    );
  });
};

export const clearAllData = async () => {
  const db = getDB();
  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      await db.runAsync(`DELETE FROM ${table};`);
    }
  });
  await AsyncStorage.removeItem(SEED_FLAG_KEY);
};

export const reseedData = async () => {
  await clearAllData();
  await seedDatabase();
  await AsyncStorage.setItem(SEED_FLAG_KEY, "1");
};

export const getTableCounts = async () => {
  const db = getDB();
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const [row] = await db.getAllAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table};`
    );
    counts[table] = row?.count ?? 0;
  }

  return counts;
};
