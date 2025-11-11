import { fragmentSchema, type Fragment } from "../models/zodSchemas";
import type { FragmentType } from "../models/types";
import { queryAsync, runAsync } from "../db/sqlite";
import { repoError } from "./errors";

type FragmentRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  type: string;
  title: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
};

const mapFragment = (row: FragmentRow): Fragment =>
  fragmentSchema.parse({
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id,
    type: row.type as FragmentType,
    title: row.title,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

type ListOptions = {
  type?: FragmentType;
  groupId?: string | null;
  search?: string;
};

export const fragmentsRepo = {
  async listByUser(userId: string, opts: ListOptions = {}) {
    try {
      const params: unknown[] = [userId];
      const where: string[] = ["user_id = ?"];

      if (opts.type) {
        where.push("type = ?");
        params.push(opts.type);
      }

      if (opts.groupId !== undefined) {
        if (opts.groupId === null) {
          where.push("group_id IS NULL");
        } else {
          where.push("group_id = ?");
          params.push(opts.groupId);
        }
      }

      if (opts.search) {
        where.push("title LIKE ?");
        params.push(`%${opts.search}%`);
      }

      const rows = await queryAsync<FragmentRow>(
        `SELECT * FROM fragments WHERE ${where.join(
          " AND "
        )} ORDER BY updated_at DESC`,
        params
      );

      return rows.map(mapFragment);
    } catch (error) {
      throw repoError("list fragments", error);
    }
  },

  async get(id: string) {
    try {
      const [row] = await queryAsync<FragmentRow>(
        "SELECT * FROM fragments WHERE id = ?",
        [id]
      );
      return row ? mapFragment(row) : null;
    } catch (error) {
      throw repoError("load fragment", error);
    }
  },

  async create(data: Fragment) {
    try {
      const payload = fragmentSchema.parse(data);
      await runAsync(
        `INSERT INTO fragments
        (id, user_id, group_id, type, title, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.id,
          payload.userId,
          payload.groupId ?? null,
          payload.type,
          payload.title,
          payload.notes ?? null,
          payload.createdAt,
          payload.updatedAt,
        ]
      );
      return payload;
    } catch (error) {
      throw repoError("create fragment", error);
    }
  },

  async update(id: string, patch: Partial<Fragment>) {
    try {
      const existing = await this.get(id);
      if (!existing) {
        throw new Error("Fragment not found");
      }
      const updated: Fragment = fragmentSchema.parse({
        ...existing,
        ...patch,
        updatedAt: Date.now(),
      });

      await runAsync(
        `UPDATE fragments
        SET title = ?, notes = ?, group_id = ?, type = ?, updated_at = ?
        WHERE id = ?`,
        [
          updated.title,
          updated.notes ?? null,
          updated.groupId ?? null,
          updated.type,
          updated.updatedAt,
          id,
        ]
      );

      return updated;
    } catch (error) {
      throw repoError("update fragment", error);
    }
  },

  async remove(id: string) {
    try {
      await runAsync("DELETE FROM fragments WHERE id = ?", [id]);
    } catch (error) {
      throw repoError("remove fragment", error);
    }
  },
};
