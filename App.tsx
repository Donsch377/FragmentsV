import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { RootTabs } from "./app/navigation/RootTabs";
import { flags } from "./app/utils/flags";
import { ensureSeedData } from "./app/db/seed";
import { installLoggerTap } from "./app/utils/logger";

const devTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#ffffff",
    card: "#ffffff",
    text: "#111111",
    border: "#e6e6e6",
    primary: "#0fb06a",
  },
};

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installLoggerTap();
    ensureSeedData().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#8ef5b0" />
        <Text className="mt-3 text-neutral-400">Preparing local db…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={devTheme}>
        <SafeAreaView
          className="flex-1 bg-surface"
          style={{ flex: 1, backgroundColor: "#ffffff" }}
        >
          <RootTabs />
          <DevBanner />
        </SafeAreaView>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const DevBanner = () => (
  <View className="absolute left-0 right-0 top-0 items-center py-1">
    <View className="rounded-full bg-accent/20 px-4 py-1">
      <Text className="text-xs font-semibold text-accent">
        LOCAL DB • devUserId: {flags.devUserId}
      </Text>
    </View>
  </View>
);
