import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GroupsScreen } from "../screens/GroupsScreen";
import { GroupDetailScreen } from "../screens/GroupDetailScreen";
import { Group } from "../types/groups";

export type GroupsStackParamList = {
  GroupsList: undefined;
  GroupDetail: { groupId: string; group?: Group };
};

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export const GroupsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: "#050505",
      },
      headerTintColor: "#ffffff",
      headerShadowVisible: false,
    }}
  >
    <Stack.Screen name="GroupsList" component={GroupsScreen} options={{ headerShown: false }} />
    <Stack.Screen
      name="GroupDetail"
      component={GroupDetailScreen}
      options={({ route }) => ({
        title: route.params.group?.name ?? "Group",
      })}
    />
  </Stack.Navigator>
);
