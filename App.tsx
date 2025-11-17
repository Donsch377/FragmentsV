import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { RootTabs } from "./app/navigation/RootTabs";

const freshTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#050505",
    card: "#050505",
    text: "#ffffff",
    border: "#121212",
    primary: "#0fb06a",
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={freshTheme}>
        <RootTabs />
        <StatusBar style="light" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
