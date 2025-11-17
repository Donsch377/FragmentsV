import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type FreshStartScreenProps = {
  title: string;
  description: string;
  steps?: string[];
  tag?: string;
};

export const FreshStartScreen = ({
  title,
  description,
  steps = [],
  tag,
}: FreshStartScreenProps) => (
  <SafeAreaView className="flex-1 bg-[#050505]">
    <View className="flex-1 justify-between px-6 py-10">
      <View>
        {tag ? (
          <Text className="text-xs font-semibold uppercase tracking-widest text-white/40">
            {tag}
          </Text>
        ) : null}
        <Text className="mt-2 text-4xl font-semibold text-white">{title}</Text>
        <Text className="mt-4 text-base leading-6 text-white/70">
          {description}
        </Text>
      </View>

      {steps.length ? (
        <View className="mt-10 space-y-3">
          {steps.map((step) => (
            <View
              key={step}
              className="rounded-2xl border border-white/10 px-4 py-3"
            >
              <Text className="text-base font-semibold text-white/95">
                {step}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-10 rounded-3xl border border-dashed border-white/20 px-4 py-6">
        <Text className="text-center text-sm text-white/60">
          Drop new components here when you are ready to mock things up.
        </Text>
      </View>
    </View>
  </SafeAreaView>
);
