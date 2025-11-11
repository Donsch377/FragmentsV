import { fragmentItemSchema, type FragmentItem } from "../models/zodSchemas";
import type { SortOrder } from "../models/types";
import { queryAsync, runAsync } from "../db/sqlite";
import { createId } from "../utils/id";
import { repoError } from "./errors";

type ItemRow = {
  id: string;
  fragment_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  base_qty: number;
  base_unit: string;
  display_qty: number | null;
  display_unit: string | null;
  notes: string | null;
};

const mapItem = (row: ItemRow): FragmentItem =>
  fragmentItemSchema.parse({
    id: row.id,
    fragmentId: row.fragment_id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    baseQty: row.base_qty,
    baseUnit: row.base_unit,
    displayQty: row.display_qty ?? undefined,
    displayUnit: row.display_unit ?? undefined,
    notes: row.notes ?? undefined,
  });

type ListOptions = {
  search?: string;
  sort?: SortOrder;
};

const normalizeText = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

export type FragmentItemInput = Omit<FragmentItem, "id"> & { id?: string };

export const inventoryRepo = {
  async listItems(fragmentId: string, opts: ListOptions = {}) {
    try {
      const params: unknown[] = [fragmentId];
      const where: string[] = ["fragment_id = ?"];

      if (opts.search) {
        where.push("(name LIKE ? OR brand LIKE ?)");
        params.push(`%${opts.search}%`, `%${opts.search}%`);
      }

      let sortClause = "name ASC";
      if (opts.sort === "name_desc") {
        sortClause = "name DESC";
      }

      const rows = await queryAsync<ItemRow>(
        `SELECT * FROM fragment_items WHERE ${where.join(
          " AND "
        )} ORDER BY ${sortClause}`,
        params
      );

      return rows.map(mapItem);
    } catch (error) {
      throw repoError("list inventory", error);
    }
  },

  async getItem(id: string) {
    try {
      const [row] = await queryAsync<ItemRow>(
        "SELECT * FROM fragment_items WHERE id = ?",
        [id]
      );
      return row ? mapItem(row) : null;
    } catch (error) {
      throw repoError("load inventory item", error);
    }
  },

  async findExisting(input: {
    fragmentId: string;
    barcode?: string | null;
    name: string;
    brand?: string | null;
  }) {
    try {
      if (input.barcode) {
        const [byBarcode] = await queryAsync<ItemRow>(
          "SELECT * FROM fragment_items WHERE fragment_id = ? AND barcode = ?",
          [input.fragmentId, input.barcode]
        );
        if (byBarcode) {
          return mapItem(byBarcode);
        }
      }

      const normalizedName = normalizeText(input.name);
      const normalizedBrand = normalizeText(input.brand);

      const [row] = await queryAsync<ItemRow>(
        `SELECT * FROM fragment_items
        WHERE fragment_id = ?
        AND LOWER(name) = ?
        AND LOWER(COALESCE(brand, '')) = ?`,
        [input.fragmentId, normalizedName, normalizedBrand]
      );

      return row ? mapItem(row) : null;
    } catch (error) {
      throw repoError("find inventory item", error);
    }
  },

  async upsertItem(input: FragmentItemInput) {
    try {
      const existing = await inventoryRepo.findExisting({
        fragmentId: input.fragmentId,
        barcode: input.barcode,
        name: input.name,
        brand: input.brand,
      });

      const payload = fragmentItemSchema.parse({
        ...input,
        id: existing?.id ?? input.id ?? createId(),
      });

      if (existing) {
        await runAsync(
          `UPDATE fragment_items
          SET name = ?, brand = ?, barcode = ?, base_qty = ?, base_unit = ?,
              display_qty = ?, display_unit = ?, notes = ?
          WHERE id = ?`,
          [
            payload.name,
            payload.brand ?? null,
            payload.barcode ?? null,
            payload.baseQty,
            payload.baseUnit,
            payload.displayQty ?? null,
            payload.displayUnit ?? null,
            payload.notes ?? null,
            existing.id,
          ]
        );

        return { ...existing, ...payload };
      }

      await runAsync(
        `INSERT INTO fragment_items
        (id, fragment_id, name, brand, barcode, base_qty, base_unit, display_qty, display_unit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.id,
          payload.fragmentId,
          payload.name,
          payload.brand ?? null,
          payload.barcode ?? null,
          payload.baseQty,
          payload.baseUnit,
          payload.displayQty ?? null,
          payload.displayUnit ?? null,
          payload.notes ?? null,
        ]
      );

      return payload;
    } catch (error) {
      throw repoError("save inventory item", error);
    }
  },

  async removeItem(id: string) {
    try {
      await runAsync("DELETE FROM fragment_items WHERE id = ?", [id]);
    } catch (error) {
      throw repoError("remove inventory item", error);
    }
  },
};
