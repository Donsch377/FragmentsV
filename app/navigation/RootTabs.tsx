import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { PantryScreen } from "../screens/PantryScreen";
import { GroupsStack } from "./GroupsStack";
import { CalendarScreen } from "../screens/CalendarScreen";
import { AiChatScreen } from "../screens/AiChatScreen";
import { MapScreen } from "../screens/MapScreen";
import { UserProfileScreen } from "../screens/UserProfileScreen";
import { RecipeCreatorScreen } from "../screens/RecipeCreatorScreen";
import { RecipeCookScreen } from "../screens/RecipeCookScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
  Map: "map",
};

const FragmentsIcon = ({ focused, color }: { focused: boolean; color: string }) => {
  const pieces = focused
    ? [
        { top: 4, left: 10 },
        { top: 4, right: 10 },
        { bottom: 4, left: 10 },
      ]
    : [
        { top: 0, left: 0 },
        { top: 0, right: 0 },
        { bottom: 0, left: 14 },
      ];
  return (
    <View style={styles.fragmentsWrapper}>
      <View style={styles.fragmentsField}>
        {pieces.map((piece, index) => (
          <View
            key={index}
            style={[
              styles.fragmentPiece,
              piece,
              { backgroundColor: focused ? "#0fb06a" : color },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const ProfileButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={{ marginLeft: 16 }} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.profileCircle}>
      <Text style={styles.profileInitial}>YOU</Text>
    </View>
  </TouchableOpacity>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route, navigation }) => ({
      headerTitle: route.name,
      headerStyle: {
        backgroundColor: "#050505",
      },
      headerTitleStyle: {
        color: "#ffffff",
        fontSize: 18,
      },
      headerTintColor: "#ffffff",
      headerLeft: () => (
        <ProfileButton onPress={() => navigation.getParent()?.navigate("UserProfile")} />
      ),
      tabBarStyle,
      tabBarActiveTintColor: "#0fb06a",
      tabBarInactiveTintColor: "#666666",
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: "600",
      },
      tabBarIcon: ({ color, size, focused }) => {
        if (route.name === "AI") {
          return <FragmentsIcon focused={focused} color={color} />;
        }
        const iconName = iconMap[route.name] ?? "ellipse";
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
    sceneContainerStyle={{ backgroundColor: "#050505" }}
  >
    <Tab.Screen name="Calendar" component={CalendarScreen} />
    <Tab.Screen name="Pantry" component={PantryScreen} />
    <Tab.Screen name="AI" component={AiChatScreen} />
    <Tab.Screen name="Groups" component={GroupsStack} />
    <Tab.Screen name="Map" component={MapScreen} />
  </Tab.Navigator>
);

export const RootTabs = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: "#050505" },
      headerTintColor: "#ffffff",
      headerTitleStyle: { color: "#ffffff" },
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: "Profile" }} />
    <Stack.Screen
      name="RecipeCreator"
      component={RecipeCreatorScreen}
      options={{ title: "Create recipe" }}
    />
    <Stack.Screen
      name="RecipeCook"
      component={RecipeCookScreen}
      options={{ title: "Cook recipe" }}
    />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  fragmentsWrapper: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  fragmentsField: {
    width: 26,
    height: 26,
    position: "relative",
  },
  fragmentPiece: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1b2337",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  profileInitial: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
});
