import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { GroupsStackParamList } from "../navigation/GroupsStack";
import { Group } from "../types/groups";

type GroupDetailRoute = RouteProp<GroupsStackParamList, "GroupDetail">;

type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  role?: "system" | "member";
};

const GROUP_TABS = ["Overview", "Recipes", "Inventory", "Members", "Settings", "Chat"] as const;
type GroupTab = (typeof GROUP_TABS)[number];

const initialSystemMessages: Message[] = [
  {
    id: "msg-1",
    sender: "System",
    text: "This space is ready for your group to start chatting.",
    timestamp: "now",
  },
];

export const GroupDetailScreen = () => {
  const route = useRoute<GroupDetailRoute>();
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

  const [activeTab, setActiveTab] = useState<GroupTab>("Overview");
  const [messages, setMessages] = useState<Message[]>(initialSystemMessages);
  const [messageText, setMessageText] = useState("");

  const handleAddRecipe = () => {
    console.log("Add recipe tapped");
  };

  const handleManageInventory = () => {
    console.log("Manage inventory tapped");
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

  const renderOverview = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Group Summary</Text>
      <Text style={styles.cardBody}>{fallbackGroup.description}</Text>
      <Text style={styles.cardMeta}>Last activity · {fallbackGroup.lastActivity}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{fallbackGroup.stats.members}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{fallbackGroup.stats.recipes}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{fallbackGroup.stats.inventory}</Text>
          <Text style={styles.statLabel}>Inventory</Text>
        </View>
      </View>
    </View>
  );

  const renderRecipes = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Shared Recipes</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleAddRecipe}>
          <Text style={styles.secondaryButtonText}>Add Recipe</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cardBody}>
        Recipes connected to this group will show up here. Wire this to the recipes table when you are
        ready.
      </Text>
    </View>
  );

  const renderInventory = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Inventory</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleManageInventory}>
          <Text style={styles.secondaryButtonText}>Manage Inventory</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coming soon</Text>
        <Text style={styles.cardBody}>
          Connect this tab to foods that belong to the group or are shared from Solo pantries.
        </Text>
      </View>
    </View>
  );

  const renderMembers = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Members</Text>
      <View style={[styles.listRow, styles.memberRow]}>
        <View>
          <Text style={styles.listTitle}>Owner</Text>
          <Text style={styles.listSubtitle}>{fallbackGroup.role === "Owner" ? "You" : "Group owner"}</Text>
        </View>
      </View>
      <Text style={[styles.cardBody, { marginTop: 12 }]}>
        Member records from Supabase will show here once membership wiring is added.
      </Text>
    </View>
  );

  const renderSettings = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Group Settings</Text>
      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>Group name</Text>
        <Text style={styles.settingsValue}>{fallbackGroup.name}</Text>
      </View>
      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>Group code</Text>
        <View style={styles.codeRow}>
          <Text style={styles.settingsValue}>{fallbackGroup.code}</Text>
          <TouchableOpacity onPress={() => console.log("Copy code", fallbackGroup.code)}>
            <Text style={styles.linkText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.dangerButton} onPress={() => console.log("Leave group")}>
        <Text style={styles.dangerButtonText}>Leave Group</Text>
      </TouchableOpacity>
      {fallbackGroup.role === "Owner" ? (
        <TouchableOpacity style={[styles.dangerButton, styles.outlineDanger]} onPress={() => console.log("Delete group")}>
          <Text style={styles.dangerButtonOutlineText}>Delete Group</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderChat = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Crew Chat</Text>
      <ScrollView style={styles.messagesList} contentContainerStyle={{ paddingBottom: 12 }}>
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
      case "Overview":
        return renderOverview();
      case "Recipes":
        return renderRecipes();
      case "Inventory":
        return renderInventory();
      case "Members":
        return renderMembers();
      case "Settings":
        return renderSettings();
      case "Chat":
        return renderChat();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.groupTitle}>{fallbackGroup.name}</Text>
            <Text style={styles.roleLabel}>{fallbackGroup.role}</Text>
            <Text style={styles.metaText}>
              {fallbackGroup.stats.members} members • {fallbackGroup.stats.recipes} recipes •{" "}
              {fallbackGroup.stats.inventory} inventory items
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
    paddingTop: 24,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
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
  statCell: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#101828",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
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
});
