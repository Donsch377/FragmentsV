import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../providers/AuthProvider";
import { RootTabs } from "./RootTabs";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { session } = useAuth();

  return session ? (
    <RootTabs />
  ) : (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#050505" },
        headerTintColor: "#ffffff",
        contentStyle: { backgroundColor: "#050505" },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Create account" }} />
    </Stack.Navigator>
  );
};
