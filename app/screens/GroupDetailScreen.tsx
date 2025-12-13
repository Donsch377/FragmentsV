import { useEffect, useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { GroupsStackParamList } from "../navigation/GroupsStack";
import { Group } from "../types/groups";
import { supabase } from "../lib/supabaseClient";
import type { TaskRecord } from "../types/tasks";
import { TaskModal } from "../components/TaskModal";
import { useAuth } from "../providers/AuthProvider";
import { DEFAULT_FOOD_IMAGE } from "../constants/images";

type GroupDetailRoute = RouteProp<GroupsStackParamList, "GroupDetail">;

type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  role?: "system" | "member";
};

type InventoryPreview = {
  id: string;
  name: string;
  image_url?: string | null;
  best_by?: string | null;
};

type RecipePreview = {
  id: string;
  name: string;
  image_url?: string | null;
  summary?: string | null;
};

const GROUP_TABS = ["Home", "Recipes", "Tasks", "Members", "Settings", "Chat"] as const;
type GroupTab = (typeof GROUP_TABS)[number];

const initialSystemMessages: Message[] = [];

const describeLinkTargets = (task: TaskRecord) => {
  if (!task.link_type) return null;
  const labels = task.link_type
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1));
  if (!labels.length) return null;
  return labels.join(" + ");
};

export const GroupDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<GroupDetailRoute>();
  const { session } = useAuth();
  const fallbackGroup: Group = useMemo(
    () => ({
      id: route.params.groupId,
      name: "Untitled Group",
      role: route.params.group?.role ?? "Member",
      description: route.params.group?.description ?? "This space is ready for your next shared pantry.",
      code: route.params.group?.code ?? "FRAG-0000",
      stats: route.params.group?.stats ?? { members: 0, recipes: 0, inventory: 0 },
      lastActivity: route.params.group?.lastActivity ?? "No activity yet",
    }),
    [route.params],
  );

  const [activeTab, setActiveTab] = useState<GroupTab>("Home");
  const [groupDetails, setGroupDetails] = useState<Partial<Group> | null>(null);
  const [groupNameInput, setGroupNameInput] = useState(fallbackGroup.name);
  const [groupDescription, setGroupDescription] = useState(fallbackGroup.description ?? "");
  const [stats, setStats] = useState({ members: fallbackGroup.stats.members, recipes: fallbackGroup.stats.recipes, inventory: fallbackGroup.stats.inventory });
  const [inventoryPreview, setInventoryPreview] = useState<InventoryPreview[]>([]);
  const [recipePreview, setRecipePreview] = useState<RecipePreview[]>([]);
  const [messages, setMessages] = useState<Message[]>(initialSystemMessages);
  const [messageText, setMessageText] = useState("");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [savingGroupName, setSavingGroupName] = useState(false);

  const displayName = groupDetails?.name ?? fallbackGroup.name;
  const displayRole = fallbackGroup.role;
  const isOwner = displayRole === "Owner";
  const inviteCode = groupDetails?.invite_code ?? fallbackGroup.code;

  const handleAddRecipe = () => {
    const groupNav = navigation.getParent();
    const rootNav = groupNav?.getParent() ?? groupNav;
    rootNav?.navigate("RecipeCreator", { groupId: fallbackGroup.id });
  };

  const handleManageInventory = () => {
    const tabNav = navigation.getParent();
    const rootNav = tabNav?.getParent() ?? tabNav;
    rootNav?.navigate("MainTabs", {
      screen: "Pantry",
      params: { groupId: fallbackGroup.id },
    });
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) {
      return;
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "You",
      text: messageText.trim(),
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, newMessage]);
    setMessageText("");
  };

  const loadGroupOverview = async () => {
    try {
      const [groupResult, memberCountResult, recipeCountResult, inventoryCountResult, latestInventory, latestRecipes] = await Promise.all([
        supabase
          .from("groups")
          .select("id, name, description, invite_code, owner_id")
          .eq("id", fallbackGroup.id)
          .single(),
        supabase
          .from("group_members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", fallbackGroup.id),
        supabase
          .from("group_recipes")
          .select("id", { count: "exact", head: true })
          .eq("group_id", fallbackGroup.id),
        supabase
          .from("group_foods")
          .select("id", { count: "exact", head: true })
          .eq("group_id", fallbackGroup.id),
        supabase
          .from("group_foods")
          .select("food:foods(id, name, image_url, best_by)")
          .eq("group_id", fallbackGroup.id)
          .order("inserted_at", { ascending: false })
          .limit(5),
        supabase
          .from("group_recipes")
          .select("recipe:recipes(id, name, image_url, summary)")
          .eq("group_id", fallbackGroup.id)
          .order("inserted_at", { ascending: false })
          .limit(5),
      ]);

      if (!groupResult.error && groupResult.data) {
        setGroupDetails(groupResult.data);
        setGroupNameInput(groupResult.data.name ?? fallbackGroup.name);
        setGroupDescription(groupResult.data.description ?? "");
      }

      const memberCount = memberCountResult.count ?? fallbackGroup.stats.members;
      const recipeCount = recipeCountResult.count ?? fallbackGroup.stats.recipes;
      const inventoryCount = inventoryCountResult.count ?? fallbackGroup.stats.inventory;
      setStats({ members: memberCount, recipes: recipeCount, inventory: inventoryCount });

      if (!latestInventory.error) {
        const entries =
          latestInventory.data
            ?.map((row: any) => row.food)
            .filter((item: any): item is InventoryPreview => Boolean(item))
            .map((item: any) => ({
              id: item.id,
              name: item.name ?? "Unnamed item",
              image_url: item.image_url,
              best_by: item.best_by ?? null,
            })) ?? [];
        setInventoryPreview(entries);
      }

      if (!latestRecipes.error) {
        const entries =
          latestRecipes.data
            ?.map((row: any) => row.recipe)
            .filter((item: any): item is RecipePreview => Boolean(item))
            .map((item: any) => ({
              id: item.id,
              name: item.name ?? "Untitled recipe",
              image_url: item.image_url,
              summary: item.summary ?? null,
            })) ?? [];
        setRecipePreview(entries);
      }
    } catch (error) {
      console.error("Unable to load group overview", error);
    }
  };

  const filterTasksByStart = (records: TaskRecord[]) => {
    const now = Date.now();
    return records.filter((task) => {
      if (!task.start_at) return true;
      const startTime = new Date(task.start_at).getTime();
      return Number.isNaN(startTime) ? true : startTime <= now;
    });
  };

  const loadGroupTasks = async () => {
    try {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("group_id", fallbackGroup.id)
        .order("start_at", { ascending: true, nullsFirst: false })
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      setTasks(filterTasksByStart(data ?? []));
    } catch (error) {
      console.error("Unable to load group tasks", error);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadGroupTasks();
  }, [fallbackGroup.id]);

  const loadGroupMembers = async () => {
    try {
      setMembersLoading(true);
      const { data: memberRows, error } = await supabase
        .from("group_members")
        .select("user_id, role, inserted_at")
        .eq("group_id", fallbackGroup.id)
        .order("inserted_at", { ascending: true });
      if (error) throw error;
      const ids = memberRows?.map((row) => row.user_id).filter(Boolean) ?? [];
      const profileMap = new Map<string, string>();
      if (ids.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", ids);
        if (profilesError) throw profilesError;
        profiles?.forEach((profile) => {
          const label = profile.display_name || profile.email || profile.id?.slice(0, 8) || "Member";
          if (profile.id) {
            profileMap.set(profile.id, label);
          }
        });
      }
      const enriched =
        memberRows
          ?.map((row) => {
            if (!row.user_id) return null;
            const label = profileMap.get(row.user_id) ?? row.user_id.slice(0, 8);
            return {
              id: row.user_id,
              name: label,
              role: row.role === "Owner" ? "Owner" : "Member",
            };
          })
          .filter((entry): entry is { id: string; name: string; role: string } => Boolean(entry)) ?? [];
      enriched.sort((a, b) => {
        if (a.role === b.role) return 0;
        if (a.role === "Owner") return -1;
        if (b.role === "Owner") return 1;
        return 0;
      });
      setMembers(enriched);
    } catch (memberError) {
      console.error("Unable to load group members", memberError);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    loadGroupMembers();
  }, [fallbackGroup.id]);

  useEffect(() => {
    loadGroupOverview();
  }, [fallbackGroup.id]);

  const toggleTaskCompleted = async (task: TaskRecord) => {
    const previous = tasks;
    const updated = tasks.map((entry) =>
      entry.id === task.id ? { ...entry, completed: !entry.completed } : entry,
    );
    setTasks(updated);
    try {
      const { error } = await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id);
      if (error) throw error;
    } catch (error) {
      console.error("Failed to toggle task", error);
      setTasks(previous);
    }
  };

  const deleteTask = async (taskId: string) => {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    } catch (error) {
      console.error("Failed to delete task", error);
      setTasks(previous);
      Alert.alert("Unable to delete", "Please try again.");
    }
  };

  const performLeaveGroup = async () => {
    if (!session?.user?.id) return;
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", fallbackGroup.id)
        .eq("user_id", session.user.id);
      if (error) throw error;
      navigation.goBack();
    } catch (error) {
      console.error("Failed to leave group", error);
      Alert.alert("Unable to leave group", "Please try again.");
    }
  };

  const handleLeaveGroup = () => {
    if (fallbackGroup.role === "Owner") {
      Alert.alert(
        "You're the owner",
        "Owners need to delete the group (or transfer ownership) instead of leaving.",
      );
      return;
    }
    Alert.alert("Leave this group?", "You'll lose access to its tasks, pantry, and recipes.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: performLeaveGroup },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete group?",
      "This removes the group and all its shared data for every member.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from("groups").delete().eq("id", fallbackGroup.id);
              if (error) throw error;
              navigation.goBack();
            } catch (error) {
              console.error("Failed to delete group", error);
              Alert.alert("Unable to delete group", "Please try again.");
            }
          },
        },
      ],
    );
  };

  const confirmDeleteTask = (taskId: string) => {
    Alert.alert("Delete task?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteTask(taskId),
      },
    ]);
  };

  const formatTaskDueDate = (task: TaskRecord) => {
    if (task.due_at) {
      return `Due ${new Date(task.due_at).toLocaleDateString()}`;
    }
    if (task.due_date) {
      return `Due ${task.due_date}`;
    }
    return "No due date yet";
  };

  const itemBestByTime = (value?: string | null) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  };

  const renderHome = () => {
    const nextTasks = tasks.slice(0, 3);
    const expiringSorted = [...inventoryPreview]
      .filter((item) => Boolean(item.best_by))
      .sort((a, b) => itemBestByTime(a.best_by) - itemBestByTime(b.best_by));
    const expiringSoonCount = expiringSorted.length;
    const expiringSoon = expiringSorted.slice(0, 3);
    const inventoryHighlights = expiringSoon.length ? expiringSoon : inventoryPreview.slice(0, 3);
    const latestActivity = fallbackGroup.lastActivity || "No recent activity yet.";

    return (
      <View style={styles.homeStack}>
        <View style={styles.card}>
          <Text style={styles.homeEyebrow}>Today in this group</Text>
          <View style={styles.homeStatRow}>
            <View style={styles.homeStat}>
              <Text style={styles.homeStatValue}>{stats.members}</Text>
              <Text style={styles.homeStatLabel}>Members</Text>
            </View>
            <View style={styles.homeStat}>
              <Text style={styles.homeStatValue}>{stats.recipes}</Text>
              <Text style={styles.homeStatLabel}>Recipes</Text>
            </View>
            <View style={styles.homeStat}>
              <Text style={styles.homeStatValue}>{expiringSoonCount}</Text>
              <Text style={styles.homeStatLabel}>Expiring soon</Text>
            </View>
          </View>
          <Text style={styles.homeActivity}>{latestActivity}</Text>
          <View style={styles.homeList}>
            <View style={styles.homeListHeader}>
              <Text style={styles.sectionTitle}>Upcoming tasks</Text>
              <TouchableOpacity onPress={() => setActiveTab("Tasks")}>
                <Text style={styles.linkText}>View all</Text>
              </TouchableOpacity>
            </View>
            {nextTasks.length ? (
              nextTasks.map((task) => (
                <View key={task.id} style={styles.homeListRow}>
                  <Text style={styles.homeListTitle}>{task.title}</Text>
                  <Text style={styles.homeListMeta}>{formatTaskDueDate(task)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.cardBody}>No tasks scheduled for the crew today.</Text>
            )}
          </View>
          <View style={styles.homeButtons}>
            <TouchableOpacity style={styles.primaryLinkButton} onPress={handleManageInventory}>
              <Text style={styles.primaryLinkButtonText}>Open group pantry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryLinkButton} onPress={() => setActiveTab("Recipes")}>
              <Text style={styles.secondaryLinkButtonText}>View recipes for this group</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Inventory highlights</Text>
            <TouchableOpacity onPress={handleManageInventory}>
              <Text style={styles.linkText}>Open full pantry</Text>
            </TouchableOpacity>
          </View>
          {inventoryHighlights.length ? (
            inventoryHighlights.map((item) => (
              <View key={item.id} style={styles.previewRowItem}>
                <Image source={{ uri: item.image_url || DEFAULT_FOOD_IMAGE }} style={styles.previewImage} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{item.name}</Text>
                  <Text style={styles.previewMeta}>
                    {item.best_by ? `Best by ${new Date(item.best_by).toLocaleDateString()}` : "No expiry set"}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.cardBody}>No shared items yet. Head to the pantry to add the first entry.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Recent recipes</Text>
            <TouchableOpacity onPress={() => setActiveTab("Recipes")}>
              <Text style={styles.linkText}>View recipes</Text>
            </TouchableOpacity>
          </View>
          {recipePreview.length ? (
            recipePreview.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.previewRowItem}>
                <Image source={{ uri: item.image_url || DEFAULT_FOOD_IMAGE }} style={styles.previewImage} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{item.name}</Text>
                  <Text style={styles.previewMeta}>{item.summary || "No summary provided"}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.cardBody}>Capture your first recipe to share prep steps with the crew.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderRecipes = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Shared Recipes</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleAddRecipe}>
          <Text style={styles.secondaryButtonText}>Add Recipe</Text>
        </TouchableOpacity>
      </View>
      {recipePreview.length ? (
        recipePreview.map((item) => (
          <View key={item.id} style={styles.previewRowItem}>
            <Image source={{ uri: item.image_url || DEFAULT_FOOD_IMAGE }} style={styles.previewImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.previewName}>{item.name}</Text>
              <Text style={styles.previewMeta}>{item.summary || "No summary yet"}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.cardBody}>No recipes yet. Tap "Add Recipe" to capture your first one.</Text>
      )}
    </View>
  );

  const renderMembers = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Members</Text>
      {membersLoading ? (
        <Text style={styles.cardBody}>Loading members…</Text>
      ) : members.length === 0 ? (
        <Text style={styles.cardBody}>No members yet. Share your invite code to add your crew.</Text>
      ) : (
        members.map((member) => (
          <View key={member.id} style={[styles.listRow, styles.memberRow]}>
            <View>
              <Text style={styles.listTitle}>
                {member.name}
                {member.id === session?.user?.id ? " (you)" : ""}
              </Text>
              <Text style={[styles.listSubtitle, member.role === "Owner" && styles.ownerSubtitle]}>{member.role}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const handleCopyCode = async () => {
    if (!fallbackGroup.code) {
      return;
    }
    try {
      await Clipboard.setStringAsync(groupDetails?.invite_code ?? fallbackGroup.code);
      Alert.alert("Copied", "Invite code copied to your clipboard.");
    } catch (error) {
      console.error("Failed to copy invite code", error);
      Alert.alert("Copy failed", "Please copy the code manually.");
    }
  };

  const handleRenameGroup = async () => {
    if (!groupNameInput.trim()) {
      Alert.alert("Group name required", "Please enter a name before saving.");
      return;
    }
    try {
      setSavingGroupName(true);
      const { error } = await supabase
        .from("groups")
        .update({ name: groupNameInput.trim(), description: groupDescription.trim() || null })
        .eq("id", fallbackGroup.id);
      if (error) throw error;
      await loadGroupOverview();
      Alert.alert("Saved", "Group details updated.");
    } catch (error) {
      console.error("Failed to update group", error);
      Alert.alert("Unable to update group", "Please try again.");
    } finally {
      setSavingGroupName(false);
    }
  };

  const renderSettings = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Group Settings</Text>
      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>Group name</Text>
        <TextInput
          style={styles.settingsInput}
          value={groupNameInput}
          onChangeText={setGroupNameInput}
          placeholder="Enter group name"
          placeholderTextColor="rgba(255,255,255,0.4)"
        />
        <TextInput
          style={[styles.settingsInput, { marginTop: 8 }]}
          value={groupDescription}
          onChangeText={setGroupDescription}
          placeholder="Description"
          placeholderTextColor="rgba(255,255,255,0.4)"
        />
        <TouchableOpacity
          style={[styles.settingsButton, (!isOwner || savingGroupName) && styles.settingsButtonDisabled]}
          onPress={handleRenameGroup}
          disabled={!isOwner || savingGroupName}
        >
          <Text style={styles.settingsButtonText}>
            {!isOwner ? "Owner only" : savingGroupName ? "Saving..." : "Save changes"}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>Group code</Text>
        <View style={styles.codeRow}>
          <Text style={styles.settingsValue}>{inviteCode}</Text>
          <TouchableOpacity onPress={handleCopyCode}>
            <Text style={styles.linkText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.dangerButton} onPress={handleLeaveGroup}>
        <Text style={styles.dangerButtonText}>Leave Group</Text>
      </TouchableOpacity>
      {fallbackGroup.role === "Owner" ? (
        <TouchableOpacity style={[styles.dangerButton, styles.outlineDanger]} onPress={handleDeleteGroup}>
          <Text style={styles.dangerButtonOutlineText}>Delete Group</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderTasks = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Group Tasks</Text>
        <TouchableOpacity style={styles.taskButton} onPress={() => setTaskModalVisible(true)}>
          <Text style={styles.taskButtonText}>New task</Text>
        </TouchableOpacity>
      </View>
      {tasksLoading ? (
        <Text style={styles.cardBody}>Loading tasks…</Text>
      ) : tasks.length === 0 ? (
        <Text style={styles.cardBody}>No tasks yet. Create one to get started.</Text>
      ) : (
        tasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[styles.taskRow, task.completed && styles.taskRowDone]}
            onPress={() => toggleTaskCompleted(task)}
          >
            <View style={[styles.taskCheckbox, task.completed && styles.taskCheckboxChecked]}>
              {task.completed ? <Text style={styles.taskCheckboxIcon}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskMeta}>
                Starts {task.start_at ? new Date(task.start_at).toLocaleString() : task.start_date || "now"} · Due{" "}
                {task.due_at ? new Date(task.due_at).toLocaleString() : task.due_date || "unset"}
              </Text>
              {task.assignee_names?.length ? (
                <Text style={styles.taskMeta}>Assigned to {task.assignee_names.join(", ")}</Text>
              ) : null}
              {task.link_type ? (
                <Text style={styles.taskMeta}>
                  Linked to {describeLinkTargets(task)}: {task.linked_text || "—"}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.taskDeleteButton} onPress={() => confirmDeleteTask(task.id)}>
              <Text style={styles.taskDeleteText}>Delete</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderChat = () => (
    <View style={styles.chatBlock}>
      <Text style={styles.sectionTitle}>Crew Chat</Text>
      <ScrollView
        style={styles.messagesList}
        contentContainerStyle={{ paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === "You" ? styles.messageBubbleOwn : styles.messageBubbleOther,
            ]}
          >
            <Text style={styles.messageSender}>{message.sender}</Text>
            <Text style={styles.messageTimestamp}>{message.timestamp}</Text>
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.messageInputRow}>
        <TextInput
          style={styles.messageInput}
          placeholder="Share what’s happening…"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={messageText}
          onChangeText={setMessageText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "Home":
        return renderHome();
      case "Recipes":
        return renderRecipes();
      case "Members":
        return renderMembers();
      case "Settings":
        return renderSettings();
      case "Tasks":
        return renderTasks();
      case "Chat":
        return renderChat();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.groupTitle}>{displayName}</Text>
            <Text style={styles.roleLabel}>{displayRole}</Text>
            <Text style={styles.metaText}>
              {stats.members} members • {stats.recipes} recipes •{" "}
              {stats.inventory} inventory items
            </Text>
          </View>

          <View style={styles.tabRow}>
            {GROUP_TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {renderTabContent()}
        </ScrollView>
      </View>
      <TaskModal
        visible={taskModalVisible}
        onClose={() => setTaskModalVisible(false)}
        onSaved={loadGroupTasks}
        defaultGroupId={fallbackGroup.id}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 30,
    fontWeight: "600",
    color: "#ffffff",
  },
  roleLabel: {
    marginTop: 6,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
  },
  metaText: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tabButtonActive: {
    backgroundColor: "#1b2337",
    borderColor: "rgba(255,255,255,0.4)",
  },
  tabLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#ffffff",
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0a101b",
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  cardBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.75)",
  },
  cardMeta: {
    marginTop: 12,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.45)",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  statCell: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#101828",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statTile: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 16,
    backgroundColor: "#101828",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  homeStack: {
    gap: 20,
  },
  homeEyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
  },
  homeStatRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  homeStat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#111927",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  homeStatValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
  homeStatLabel: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  homeActivity: {
    marginTop: 12,
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
  },
  homeList: {
    marginTop: 16,
    gap: 8,
  },
  homeListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  homeListRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  homeListTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  homeListMeta: {
    marginTop: 2,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  homeButtons: {
    marginTop: 16,
    gap: 10,
  },
  primaryLinkButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0fb06a",
    alignItems: "center",
  },
  primaryLinkButtonText: {
    color: "#021004",
    fontWeight: "700",
  },
  secondaryLinkButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  secondaryLinkButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  listRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  listTitle: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "600",
  },
  listSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  ownerSubtitle: {
    color: "#facc15",
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberActions: {
    gap: 4,
  },
  disabledAction: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  settingsRow: {
    marginTop: 12,
  },
  settingsLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  settingsInput: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
  },
  settingsButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  settingsButtonDisabled: {
    opacity: 0.6,
  },
  settingsButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  settingsValue: {
    marginTop: 4,
    fontSize: 16,
    color: "#ffffff",
  },
  codeRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkText: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "600",
  },
  previewRowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#111111",
  },
  previewName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  previewMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  dangerButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  outlineDanger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.6)",
  },
  dangerButtonOutlineText: {
    color: "#f87171",
    fontSize: 15,
    fontWeight: "600",
  },
  chatBlock: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0a101b",
    padding: 16,
    marginBottom: 20,
  },
  messagesList: {
    maxHeight: 220,
    marginTop: 16,
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
  },
  messageBubbleOwn: {
    backgroundColor: "#1d283a",
  },
  messageBubbleOther: {
    backgroundColor: "#0d1427",
  },
  messageSender: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  messageTimestamp: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  messageText: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  messageInputRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    color: "#ffffff",
    backgroundColor: "#0a0f1a",
  },
  sendButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    justifyContent: "center",
    backgroundColor: "#0fb06a",
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  taskButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  taskButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  taskRowDone: {
    opacity: 0.5,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  taskCheckboxChecked: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  taskCheckboxIcon: {
    color: "#050505",
    fontWeight: "700",
  },
  taskTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  taskMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  taskDeleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  taskDeleteText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
  },
});
