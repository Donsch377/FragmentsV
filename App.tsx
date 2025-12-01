import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { AuthProvider } from "./app/providers/AuthProvider";
import { AppNavigator } from "./app/navigation/AppNavigator";

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

LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={freshTheme}>
          <AppNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
