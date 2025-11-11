import { groupSchema, type Group } from "../models/zodSchemas";
import { queryAsync, runAsync } from "../db/sqlite";
import { createId } from "../utils/id";
import { repoError } from "./errors";

type GroupRow = {
  id: string;
  name: string;
  created_at: number;
};

const mapGroup = (row: GroupRow): Group =>
  groupSchema.parse({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  });

export const groupsRepo = {
  async listGroups(userId: string) {
    try {
      const rows = await queryAsync<GroupRow>(
        `SELECT g.* FROM groups g
        INNER JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.created_at DESC`,
        [userId]
      );

      return rows.map(mapGroup);
    } catch (error) {
      throw repoError("list groups", error);
    }
  },

  async createGroup(name: string, userId: string) {
    try {
      const id = createId();
      const now = Date.now();

      await runAsync(
        `INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)`,
        [id, name, now]
      );

      await runAsync(
        `INSERT OR REPLACE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`,
        [id, userId, "owner"]
      );

      return mapGroup({ id, name, created_at: now });
    } catch (error) {
      throw repoError("create group", error);
    }
  },

  async joinGroup(groupId: string, userId: string) {
    try {
      await runAsync(
        `INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')`,
        [groupId, userId]
      );
    } catch (error) {
      throw repoError("join group", error);
    }
  },

  async leaveGroup(groupId: string, userId: string) {
    try {
      await runAsync(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, [
        groupId,
        userId,
      ]);
    } catch (error) {
      throw repoError("leave group", error);
    }
  },
};
