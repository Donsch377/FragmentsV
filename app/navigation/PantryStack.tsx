import { createStackNavigator } from "@react-navigation/stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TouchableOpacity, Text } from "react-native";
import { PantryListScreen } from "../screens/PantryListScreen";
import { PantryDetailScreen } from "../screens/PantryDetailScreen";
import { PantryEditScreen } from "../screens/PantryEditScreen";
import { DebugScreen } from "../screens/DebugScreen";

export type PantryStackParamList = {
  PantryList: undefined;
  PantryDetail: { itemId: string };
  PantryEdit: { itemId?: string } | undefined;
  Debug: undefined;
};

export type PantryStackProps<T extends keyof PantryStackParamList> =
  NativeStackScreenProps<PantryStackParamList, T>;

const Stack = createStackNavigator<PantryStackParamList>();

export const PantryStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: "#050505" },
      headerTintColor: "#fff",
    }}
  >
    <Stack.Screen
      name="PantryList"
      component={PantryListScreen}
      options={({ navigation }) => ({
        title: "Pantry",
        headerRight: () => (
          <TouchableOpacity
            className="rounded-full bg-neutral-800 px-3 py-1"
            onPress={() => navigation.navigate("Debug")}
          >
            <Text className="text-xs font-semibold uppercase text-neutral-300">
              Debug
            </Text>
          </TouchableOpacity>
        ),
      })}
    />
    <Stack.Screen
      name="PantryDetail"
      component={PantryDetailScreen}
      options={{ title: "Item Detail" }}
    />
    <Stack.Screen
      name="PantryEdit"
      component={PantryEditScreen}
      options={{ title: "Edit Item" }}
    />
    <Stack.Screen name="Debug" component={DebugScreen} />
  </Stack.Navigator>
);
