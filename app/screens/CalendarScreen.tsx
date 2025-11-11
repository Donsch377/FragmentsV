import { useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { usePrefsStore } from "../stores/usePrefsStore";
import { Card } from "../components/Card";

export const CalendarScreen = () => {
  const { prefs, load } = usePrefsStore();

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView className="flex-1 bg-surface p-4">
      <View className="mb-4 flex-row gap-2">
        {["Today", "Plan"].map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 rounded-full py-2 ${
              tab === "Today" ? "bg-accent/20" : "bg-neutral-800"
            }`}
          >
            <Text
              className={`text-center text-sm font-semibold ${
                tab === "Today" ? "text-accent" : "text-neutral-300"
              }`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card title="Quick Stats">
        <View className="flex-row gap-3">
          {(prefs?.nutritionPrefs ?? ["Calories", "Protein"]).map((metric) => (
            <View key={metric} className="flex-1 rounded-2xl bg-surface-muted p-3">
              <Text className="text-sm text-neutral-400">{metric}</Text>
              <Text className="mt-1 text-2xl font-semibold text-white">
                —
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
};
