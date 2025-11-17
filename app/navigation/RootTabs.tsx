import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FreshStartScreen } from "../screens/FreshStartScreen";
import { PantryScreen } from "../screens/PantryScreen";

const Tab = createBottomTabNavigator();

const tabBarStyle = {
  backgroundColor: "#050505",
  borderTopWidth: 1,
  borderTopColor: "#1a1a1a",
  height: 72,
  paddingTop: 12,
  paddingBottom: 12,
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
      tabBarInactiveTintColor: "#666666",
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: "600",
      },
      tabBarIcon: ({ color, size }) => {
        const iconName = iconMap[route.name] ?? "ellipse";
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
    sceneContainerStyle={{ backgroundColor: "#050505" }}
  >
    <Tab.Screen name="Calendar" component={CalendarFreshScreen} />
    <Tab.Screen name="Pantry" component={PantryScreen} />
    <Tab.Screen name="Groups" component={GroupsFreshScreen} />
    <Tab.Screen name="Settings" component={SettingsFreshScreen} />
  </Tab.Navigator>
);

const CalendarFreshScreen = () => (
  <FreshStartScreen
    tag="Calendar"
    title="Plan your day from scratch"
    description="Start by deciding what matters for a single day: meals, prep, workouts, or anything else you want to see at a glance."
    steps={[
      "Sketch the sections you want visible on day one.",
      "Add rough component placeholders (cards, checklists, timers).",
      "Decide how someone updates or reorders items.",
    ]}
  />
);

const GroupsFreshScreen = () => (
  <FreshStartScreen
    tag="Groups"
    title="Nothing is set in stone"
    description="Use this space to explore how groups or households collaborate—messages, shared plans, or approvals."
    steps={[
      "Define who is in a group and what they see.",
      "Call out the primary shared activity.",
      "Highlight one metric that makes collaboration worth it.",
    ]}
  />
);

const SettingsFreshScreen = () => (
  <FreshStartScreen
    tag="Settings"
    title="Preferences live here"
    description="Keep this simple for now. Decide which toggles or inputs you really need before wiring anything up."
    steps={[
      "List the decisions a user must make.",
      "Group related toggles into small cards.",
      "Plan how to save or undo changes.",
    ]}
  />
);
