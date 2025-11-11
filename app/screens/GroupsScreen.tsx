import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useGroupsStore } from "../stores/useGroupsStore";

export const GroupsScreen = () => {
  const { groups, load, createGroup, joinGroup, activeGroupId, setActiveGroup } =
    useGroupsStore();
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async () => {
    if (!newGroupName.trim()) {
      return;
    }
    await createGroup(newGroupName.trim());
    setNewGroupName("");
  };

  return (
    <ScrollView className="flex-1 bg-surface p-4">
      <View className="rounded-3xl bg-surface-muted p-4">
        <Text className="text-sm font-semibold text-neutral-200">
          New Group
        </Text>
        <TextInput
          placeholder="Group name"
          placeholderTextColor="#666"
          value={newGroupName}
          onChangeText={setNewGroupName}
          className="mt-3 rounded-2xl bg-surface-muted px-4 py-3"
          style={{ color: "#111" }}
        />
        <TouchableOpacity
          className="mt-3 rounded-2xl bg-accent/20 py-2"
          onPress={onCreate}
        >
          <Text className="text-center font-semibold text-accent">
            Create Group
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4 rounded-3xl bg-surface-muted p-4">
        <Text className="text-sm font-semibold text-neutral-200">
          Join by Code
        </Text>
        <TextInput
          placeholder="Share code"
          placeholderTextColor="#666"
          value={joinCode}
          onChangeText={setJoinCode}
          className="mt-3 rounded-2xl bg-surface-muted px-4 py-3"
          style={{ color: "#111" }}
        />
        <TouchableOpacity
          className="mt-3 rounded-2xl border border-neutral-700 py-2"
          onPress={async () => {
            if (joinCode) {
              await joinGroup(joinCode);
              setJoinCode("");
            }
          }}
        >
          <Text className="text-center font-semibold text-neutral-300">
            Join (stub)
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-6">
        <Text className="mb-3 text-sm font-semibold text-neutral-300">
          Your Groups
        </Text>
        {groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            className={`mb-2 rounded-2xl px-4 py-3 ${
              group.id === activeGroupId ? "bg-accent/20" : "bg-surface-muted"
            }`}
            onPress={() => setActiveGroup(group.id)}
          >
            <Text
              className={`text-lg font-semibold ${
                group.id === activeGroupId ? "text-accent" : "text-black"
              }`}
            >
              {group.name}
            </Text>
            <Text className="text-xs text-neutral-500">
              since {new Date(group.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};
