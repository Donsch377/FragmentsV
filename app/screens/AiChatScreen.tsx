import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

export const AiChatScreen = () => (
  <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <Text style={styles.heading}>Fragments AI</Text>
      <Text style={styles.description}>
        Chat with your assistant to plan meals, update tasks, and move faster. Hook this up to your AI service
        when you are ready.
      </Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  heading: {
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
  },
  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
    color: "rgba(255,255,255,0.7)",
  },
});
