import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CalendarScreen } from "../screens/CalendarScreen";
import { PantryStack } from "./PantryStack";
import { GroupsScreen } from "../screens/GroupsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

const tabBarStyle = {
  backgroundColor: "#ffffff",
  borderTopWidth: 1,
  borderTopColor: "#e6e6e6",
  position: "absolute" as const,
  left: 16,
  right: 16,
  bottom: 16,
  borderRadius: 999,
  height: 64,
  paddingTop: 6,
  paddingBottom: 6,
  elevation: 5,
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
};

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  Calendar: "calendar",
  Pantry: "basket",
  Groups: "people",
  Settings: "settings",
};

export const RootTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle,
      tabBarActiveTintColor: "#0fb06a",
      tabBarInactiveTintColor: "#5c5c5c",
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: "600",
      },
      tabBarIcon: ({ color, size }) => {
        const iconName = iconMap[route.name] ?? "ellipse";
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
    sceneContainerStyle={{ backgroundColor: "#ffffff" }}
  >
    <Tab.Screen name="Calendar" component={CalendarScreen} />
    <Tab.Screen
      name="Pantry"
      component={PantryStack}
      options={{ headerShown: false }}
    />
    <Tab.Screen name="Groups" component={GroupsScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);
