import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PANTRY_TAB_OPTIONS = ["Foods", "Tools", "Recipes"] as const;
type PantryTab = (typeof PANTRY_TAB_OPTIONS)[number];

const TAB_DESCRIPTIONS: Record<PantryTab, string> = {
  Foods: "Perishable and non-perishable foods should live in one of these sections.",
  Tools: "Track utensils, appliances, and prep gear that belong to you or a crew.",
  Recipes:
    "Store ideas or full recipes; each one is owned by a single pantry (solo or group).",
};

export const PantryScreen = () => {
  const [activeTab, setActiveTab] = useState<PantryTab>("Foods");
  const contextualNote = useMemo(() => TAB_DESCRIPTIONS[activeTab], [activeTab]);

  return (
    <SafeAreaView className="flex-1 bg-[#060a13]">
      <ScrollView className="flex-1 px-5 pt-8" contentContainerStyle={{ paddingBottom: 64 }}>
        <View className="rounded-3xl border border-white/10 bg-[#0c1424] px-5 py-6 shadow-[0px_30px_70px_rgba(0,0,0,0.65)]">
          <Text
            className="text-xs font-semibold uppercase text-white/40"
            style={{ letterSpacing: 3 }}
          >
            Pantry
          </Text>
          <Text className="mt-3 text-4xl font-semibold text-white">
            Personal &amp; group pantries in one feed
          </Text>
          <Text className="mt-3 text-base leading-6 text-white/70">
            Everything lives inside exactly one pantry—your own shelf or a shared crew.
            Owner tags make it obvious where “Banana (Personal)” or “Peanut Butter (Three Amigos)” belong.
          </Text>
        </View>

        <View className="mt-6 rounded-[24px] border border-white/10 bg-[#0b1120] p-3">
          <Text className="text-sm font-semibold uppercase tracking-wide text-white/50">
            Inventory categories
          </Text>
          <View className="mt-3 flex-row gap-2">
            {PANTRY_TAB_OPTIONS.map((tab) => (
              <TouchableOpacity
                key={tab}
                className={`flex-1 rounded-2xl border px-4 py-3 ${
                  activeTab === tab ? "border-white/50 bg-[#1b2337]" : "border-transparent bg-[#0b152e]"
                }`}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.92}
              >
                <Text
                  className={`text-center text-sm font-semibold ${
                    activeTab === tab ? "text-white" : "text-white/50"
                  }`}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mt-6 rounded-[28px] border border-white/15 bg-[#11182b] px-5 py-5">
          <Text className="text-sm font-semibold text-white/80">{activeTab} overview</Text>
          <Text className="mt-2 text-xs font-semibold uppercase tracking-widest text-white/45">
            How to use this section
          </Text>
          <Text className="mt-2 text-sm leading-relaxed text-white/70">{contextualNote}</Text>
          <View className="mt-4 rounded-2xl border border-white/10 bg-[#0d1427] px-4 py-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Ownership label
            </Text>
            <Text className="mt-1 text-base font-semibold text-white">
              Banana <Text className="text-sm font-normal text-white/60">(Personal)</Text>
            </Text>
            <Text className="text-base font-semibold text-white">
              Peanut Butter{" "}
              <Text className="text-sm font-normal text-white/60">(Three Amigos)</Text>
            </Text>
            <Text className="mt-3 text-xs text-white/60">
              Every item picks exactly one owner pantry (a “personal” pantry is just a solo group).
            </Text>
          </View>
          <Text className="mt-4 text-sm font-semibold text-white/70">
            No live entries wired up—drop your list component here when ready.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
