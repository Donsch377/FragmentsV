import { supabase } from "../lib/supabaseClient";

export type SimpleGroup = { id: string; name: string };

const SOLO_GROUP_NAME = "Solo";

export const ensureSoloGroup = async (userId?: string | null) => {
  if (!userId) return null;
  try {
    const { data: existing, error: existingError } = await supabase
      .from("groups")
      .select("id")
      .eq("owner_id", userId)
      .eq("name", SOLO_GROUP_NAME)
      .maybeSingle();
    if (existingError && existingError.code !== "PGRST116") throw existingError;
    const targetId = existing?.id;
    if (targetId) {
      await supabase
        .from("group_members")
        .upsert(
          { group_id: targetId, user_id: userId, role: "Owner" },
          { onConflict: "group_id,user_id" },
        );
      return targetId;
    }
    const { data: inserted, error } = await supabase
      .from("groups")
      .insert({
        name: SOLO_GROUP_NAME,
        description: "Personal pantry",
        owner_id: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const soloId = inserted.id;
    await supabase
      .from("group_members")
      .upsert(
        { group_id: soloId, user_id: userId, role: "Owner" },
        { onConflict: "group_id,user_id" },
      );
    return soloId;
  } catch (error) {
    console.error("Failed to ensure solo group", error);
    return null;
  }
};

export const ensureGroupMembership = async (
  groupId?: string | null,
  role: "Owner" | "Member" = "Member",
): Promise<boolean> => {
  if (!groupId) {
    console.warn("ensureGroupMembership called without groupId");
    return false;
  }
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Failed to load session while ensuring membership", sessionError);
      return false;
    }
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      console.warn("No authenticated user when ensuring membership");
      return false;
    }
    const { error } = await supabase
      .from("group_members")
      .upsert(
        { group_id: groupId, user_id: userId, role },
        { onConflict: "group_id,user_id" },
      );
    if (error) {
      console.error("Failed to ensure group membership", { groupId, userId, error });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to ensure group membership", { groupId, error });
    return false;
  }
};

export const fetchAccessibleGroups = async (userId?: string | null): Promise<SimpleGroup[]> => {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name")
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (data && data.length) {
      return data.map((row: any) => ({ id: row.id as string, name: row.name as string }));
    }
    const soloId = await ensureSoloGroup(userId);
    return soloId ? [{ id: soloId, name: SOLO_GROUP_NAME }] : [];
  } catch (error) {
    console.error("Failed to load groups", error);
    const soloId = await ensureSoloGroup(userId);
    return soloId ? [{ id: soloId, name: SOLO_GROUP_NAME }] : [];
  }
};
