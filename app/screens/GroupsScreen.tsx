import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Group } from "../types/groups";
import type { GroupsStackParamList } from "../navigation/GroupsStack";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

type NavigationProp = NativeStackNavigationProp<GroupsStackParamList, "GroupsList">;

export const GroupsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { session } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setJoinModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const orderedGroups = useMemo(() => {
    if (!groups.length) return [];
    const solo = groups.find((g) => g.name === "Solo");
    const rest = groups.filter((g) => g.name !== "Solo");
    return solo ? [solo, ...rest] : rest;
  }, [groups]);

  const mapRowToGroup = (row: any): Group => {
    const role: Group["role"] =
      row.owner_id && row.owner_id === session?.user?.id ? "Owner" : "Member";
    return {
      id: row.id,
      name: row.name,
      role,
      description: row.description ?? undefined,
      code: row.invite_code ?? "",
      stats: {
        members: row.member_count ?? 1,
        recipes: row.recipe_count ?? 0,
        inventory: row.inventory_count ?? 0,
      },
      lastActivity: row.last_activity ?? undefined,
    };
  };

  useEffect(() => {
    const loadGroups = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("groups")
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        setGroups((data ?? []).map(mapRowToGroup));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadGroups();
  }, [session?.user?.id]);

  const handleSelectGroup = (group: Group) => {
    navigation.navigate("GroupDetail", { groupId: group.id, group });
  };

  const resetCreateFields = () => {
    setNewGroupName("");
    setNewGroupDescription("");
  };

  const resetJoinFields = () => {
    setJoinCode("");
  };

  const generateGroupCode = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const suffix = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join(
      "",
    );
    return `FRAG-${suffix}`;
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      return;
    }

    const code = generateGroupCode();
    try {
      const { data, error } = await supabase
        .from("groups")
        .insert({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          invite_code: code,
          owner_id: session?.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      setGroups((prev) => [mapRowToGroup(data), ...prev]);
    } catch (error) {
      console.error(error);
    }

    setCreateModalVisible(false);
    resetCreateFields();
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      return;
    }

    const code = joinCode.trim().toUpperCase();
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("invite_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return;
      }
      if (session?.user?.id) {
        await supabase.from("group_members").insert({
          group_id: data.id,
          user_id: session.user.id,
          role: "Member",
        });
      }
      setGroups((prev) => {
        const exists = prev.some((g) => g.id === data.id);
        if (exists) return prev;
        return [mapRowToGroup(data), ...prev];
      });
    } catch (error) {
      console.error(error);
    }

    setJoinModalVisible(false);
    resetJoinFields();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.heading}>Your Groups</Text>
          <Text style={styles.subheading}>Personal shelves plus shared crews all in one feed.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#0fb06a" />
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : orderedGroups.length ? (
          <View style={styles.groupList}>
            {orderedGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                onPress={() => handleSelectGroup(group)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text
                    style={[
                      styles.roleBadge,
                      group.role === "Owner" ? styles.ownerBadge : styles.memberBadge,
                    ]}
                  >
                    {group.role}
                  </Text>
                </View>
                {group.description ? (
                  <Text style={styles.groupDescription}>{group.description}</Text>
                ) : null}
                <Text style={styles.groupMeta}>
                  {group.stats.members} members • {group.stats.recipes} recipes •{" "}
                  {group.stats.inventory} items
                </Text>
                {group.lastActivity ? (
                  <Text style={styles.groupActivity}>Last activity: {group.lastActivity}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.loadingState}>
            <Text style={styles.loadingText}>No groups yet. Create or join one below.</Text>
          </View>
        )}

        <View style={styles.primaryButtons}>
          <TouchableOpacity style={[styles.primaryButton, styles.createButton]} onPress={() => setCreateModalVisible(true)}>
            <Text style={styles.primaryButtonText}>Create Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, styles.joinButton]} onPress={() => setJoinModalVisible(true)}>
            <Text style={styles.primaryButtonText}>Join Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isCreateModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Group</Text>
            <TextInput
              placeholder="Group name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newGroupName}
              onChangeText={setNewGroupName}
              style={styles.input}
            />
            <TextInput
              placeholder="Description (optional)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              style={[styles.input, styles.textArea]}
              multiline
            />
            <TouchableOpacity style={[styles.primaryButton, styles.createButton]} onPress={handleCreateGroup}>
              <Text style={styles.primaryButtonText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isJoinModalVisible} animationType="slide" transparent onRequestClose={() => setJoinModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join Group</Text>
            <TextInput
              placeholder="Group Code"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoCapitalize="characters"
              value={joinCode}
              onChangeText={setJoinCode}
              style={styles.input}
            />
            <TouchableOpacity style={[styles.primaryButton, styles.joinButton]} onPress={handleJoin}>
              <Text style={styles.primaryButtonText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setJoinModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: "600",
    color: "#ffffff",
  },
  subheading: {
    marginTop: 6,
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
  },
  groupList: {
    gap: 16,
  },
  groupCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0b0f18",
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  roleBadge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    textTransform: "uppercase",
  },
  ownerBadge: {
    backgroundColor: "rgba(15,176,106,0.15)",
    color: "#0fb06a",
  },
  memberBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.8)",
  },
  groupDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.75)",
  },
  groupMeta: {
    marginTop: 12,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.45)",
  },
  groupActivity: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  primaryButtons: {
    marginTop: 28,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  createButton: {
    backgroundColor: "#0fb06a",
  },
  joinButton: {
    backgroundColor: "#2563eb",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 16,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    marginBottom: 12,
    backgroundColor: "#111827",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalClose: {
    marginTop: 8,
    alignItems: "center",
  },
  modalCloseText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  loadingState: {
    marginTop: 16,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
  },
});
