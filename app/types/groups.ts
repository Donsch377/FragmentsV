export type GroupRole = "Owner" | "Member";

export type GroupStats = {
  members: number;
  recipes: number;
  inventory: number;
};

export type Group = {
  id: string;
  name: string;
  role: GroupRole;
  description?: string;
  code: string;
  stats: GroupStats;
  lastActivity?: string;
};
