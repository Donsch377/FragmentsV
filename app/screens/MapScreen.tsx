import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

export const MapScreen = () => (
  <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
    <View style={styles.container}>
      <Text style={styles.title}>Map view</Text>
      <Text style={styles.subtitle}>
        Drop your pantry, crew, or delivery map here. This stub simply holds the place of your eventual
        experience.
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
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
    color: "rgba(255,255,255,0.65)",
  },
});
