import { describe, it, expect, beforeEach, vi } from "vitest";

type MockRow = {
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

const mockRows: MockRow[] = [];

vi.mock("../../db/sqlite", () => {
  const findRow = (id: string) => mockRows.find((row) => row.id === id);

  return {
    queryAsync: async (sql: string, params: unknown[]) => {
      if (sql.includes("barcode = ?")) {
        const [fragmentId, barcode] = params as string[];
        return mockRows.filter(
          (row) => row.fragment_id === fragmentId && row.barcode === barcode
        );
      }

      if (sql.includes("LOWER(name) = ?")) {
        const [fragmentId, name, brand] = params as string[];
        return mockRows.filter(
          (row) =>
            row.fragment_id === fragmentId &&
            row.name.toLowerCase() === name &&
            (row.brand ?? "").toLowerCase() === brand
        );
      }

      return [];
    },
    runAsync: async (sql: string, params: unknown[]) => {
      if (sql.startsWith("INSERT INTO fragment_items")) {
        const [
          id,
          fragmentId,
          name,
          brand,
          barcode,
          baseQty,
          baseUnit,
          displayQty,
          displayUnit,
          notes,
        ] = params as [
          string,
          string,
          string,
          string | null,
          string | null,
          number,
          string,
          number | null,
          string | null,
          string | null,
        ];
        mockRows.push({
          id,
          fragment_id: fragmentId,
          name,
          brand,
          barcode,
          base_qty: baseQty,
          base_unit: baseUnit,
          display_qty: displayQty,
          display_unit: displayUnit,
          notes,
        });
      } else if (sql.startsWith("UPDATE fragment_items")) {
        const [
          name,
          brand,
          barcode,
          baseQty,
          baseUnit,
          displayQty,
          displayUnit,
          notes,
          id,
        ] = params as [
          string,
          string | null,
          string | null,
          number,
          string,
          number | null,
          string | null,
          string | null,
          string,
        ];
        const row = findRow(id);
        if (row) {
          Object.assign(row, {
            name,
            brand,
            barcode,
            base_qty: baseQty,
            base_unit: baseUnit,
            display_qty: displayQty,
            display_unit: displayUnit,
            notes,
          });
        }
      }
      return { changes: 1, lastInsertRowId: 0 };
    },
  };
});

import { inventoryRepo } from "../inventoryRepo";

const baseInput = {
  fragmentId: "fragment-1",
  name: "Oats",
  brand: "Better Foods",
  barcode: null,
  baseQty: 500,
  baseUnit: "g" as const,
};

describe("inventoryRepo.upsertItem", () => {
  beforeEach(() => {
    mockRows.length = 0;
  });

  it("inserts a new record when no identity match", async () => {
    const result = await inventoryRepo.upsertItem(baseInput);
    expect(result.name).toBe("Oats");
    expect(mockRows).toHaveLength(1);
  });

  it("updates when barcode matches", async () => {
    await inventoryRepo.upsertItem({ ...baseInput, barcode: "111" });
    await inventoryRepo.upsertItem({
      ...baseInput,
      barcode: "111",
      baseQty: 600,
    });
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0].base_qty).toBe(600);
  });

  it("updates when name + brand match without barcode", async () => {
    await inventoryRepo.upsertItem(baseInput);
    await inventoryRepo.upsertItem({
      ...baseInput,
      barcode: null,
      baseQty: 800,
    });
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0].base_qty).toBe(800);
  });
});
