import { create } from "zustand";
import type { Group } from "../models/zodSchemas";
import { groupsRepo } from "../repos/groupsRepo";
import { flags } from "../utils/flags";

type GroupsState = {
  groups: Group[];
  activeGroupId: string | null;
  loading: boolean;
  load: () => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  setActiveGroup: (groupId: string | null) => void;
};

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  activeGroupId: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const groups = await groupsRepo.listGroups(flags.devUserId);
      set({
        groups,
        loading: false,
        activeGroupId: groups[0]?.id ?? null,
      });
    } catch (error) {
      set({ loading: false });
      console.error(error);
    }
  },

  createGroup: async (name) => {
    const group = await groupsRepo.createGroup(name, flags.devUserId);
    set({ groups: [group, ...get().groups], activeGroupId: group.id });
    return group;
  },

  joinGroup: async (groupId) => {
    await groupsRepo.joinGroup(groupId, flags.devUserId);
    await get().load();
  },

  leaveGroup: async (groupId) => {
    await groupsRepo.leaveGroup(groupId, flags.devUserId);
    await get().load();
  },

  setActiveGroup: (groupId) => {
    set({ activeGroupId: groupId });
  },
}));
