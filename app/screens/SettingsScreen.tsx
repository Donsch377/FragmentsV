import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
} from "react-native";
import { usePrefsStore } from "../stores/usePrefsStore";
import { flags } from "../utils/flags";

const METRICS = ["Calories", "Protein", "Carbs", "Fat", "Fiber", "Sugar"];
const SHARE_KEY = "__share_with_groups__";

export const SettingsScreen = () => {
  const { prefs, load, save } = usePrefsStore();
  const [drafts, setDrafts] = useState({
    likes: "",
    dislikes: "",
    allergies: "",
  });

  useEffect(() => {
    load();
  }, [load]);

  const updateArray = (
    field: "likes" | "dislikes" | "allergies",
    value: string,
    remove = false
  ) => {
    if (!prefs) {
      return;
    }
    const current = [...prefs[field]];
    if (remove) {
      const next = current.filter((item) => item !== value);
      save({ ...prefs, [field]: next });
      return;
    }
    if (!value.trim()) {
      return;
    }
    const next = [...new Set([...current, value.trim()])];
    save({ ...prefs, [field]: next });
    setDrafts((prev) => ({ ...prev, [field]: "" }));
  };

  const toggleMetric = (metric: string) => {
    if (!prefs) {
      return;
    }
    const hasMetric = prefs.nutritionPrefs.includes(metric);
    const filtered = prefs.nutritionPrefs.filter((m) => m !== metric);
    const nextPrefs = hasMetric
      ? filtered
      : [...filtered, metric];
    save({ ...prefs, nutritionPrefs: nextPrefs });
  };

  const toggleShare = () => {
    if (!prefs) {
      return;
    }
    const isSharing = prefs.nutritionPrefs.includes(SHARE_KEY);
    const filtered = prefs.nutritionPrefs.filter((m) => m !== SHARE_KEY);
    const nextPrefs = isSharing ? filtered : [...filtered, SHARE_KEY];
    save({ ...prefs, nutritionPrefs: nextPrefs });
  };

  const isSharing = prefs?.nutritionPrefs.includes(SHARE_KEY) ?? false;

  return (
    <ScrollView className="flex-1 bg-surface p-4">
      <View className="rounded-3xl bg-surface-muted p-4">
        <Text className="text-sm font-semibold text-neutral-200">
          Nutrition Preferences
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {METRICS.map((metric) => {
            const active = prefs?.nutritionPrefs.includes(metric);
            return (
              <TouchableOpacity
                key={metric}
                className={`rounded-full px-3 py-1 ${
                  active ? "bg-accent/20" : "bg-neutral-800"
                }`}
                onPress={() => toggleMetric(metric)}
              >
                <Text
                  className={`text-sm ${
                    active ? "text-accent" : "text-neutral-300"
                  }`}
                >
                  {metric}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {(["likes", "dislikes", "allergies"] as const).map((field) => (
        <View key={field} className="mt-4 rounded-3xl bg-surface-muted p-4">
          <Text className="text-sm font-semibold text-neutral-200 capitalize">
            {field}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(prefs?.[field] ?? []).map((value) => (
              <TouchableOpacity
                key={value}
                className="rounded-full bg-neutral-800 px-3 py-1"
                onPress={() => updateArray(field, value, true)}
              >
                <Text className="text-sm text-neutral-200">{value} ×</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="mt-3 flex-row gap-2">
            <TextInput
              placeholder={`Add ${field}`}
              placeholderTextColor="#666"
              value={drafts[field]}
              onChangeText={(text) =>
                setDrafts((prev) => ({ ...prev, [field]: text }))
              }
              className="flex-1 rounded-2xl bg-surface-muted px-4 py-3"
              style={{ color: "#111" }}
            />
            <TouchableOpacity
              className="rounded-2xl bg-accent/20 px-4 py-3"
              onPress={() => updateArray(field, drafts[field])}
            >
              <Text className="text-center text-sm font-semibold text-accent">
                Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View className="mt-4 flex-row items-center justify-between rounded-3xl bg-surface-muted p-4">
        <View>
          <Text className="text-base font-semibold text-white">
            Share with my groups
          </Text>
          <Text className="text-sm text-neutral-400">
            Uses local flag until cloud sync arrives.
          </Text>
        </View>
        <Switch value={isSharing} onValueChange={toggleShare} />
      </View>

      <View className="mt-4 rounded-3xl bg-surface-muted p-4">
        <Text className="text-sm text-neutral-300">devUserId</Text>
        <Text className="text-lg font-semibold text-white">
          {flags.devUserId}
        </Text>
      </View>
    </ScrollView>
  );
};
