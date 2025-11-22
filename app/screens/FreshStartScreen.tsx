import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View, Text } from "react-native";

type FreshStartScreenProps = {
  title: string;
  description: string;
  steps?: string[];
  tag?: string;
};

export const FreshStartScreen = ({
  title,
  description,
  steps = [],
  tag,
}: FreshStartScreenProps) => (
  <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <View>
        {tag ? <Text style={styles.tag}>{tag}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {steps.length ? (
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View
              key={step}
              style={[styles.stepCard, index > 0 && styles.stepCardSpacing]}
            >
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderText}>
          Drop new components here when you are ready to mock things up.
        </Text>
      </View>
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
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  tag: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)",
  },
  title: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: "600",
    color: "#ffffff",
  },
  description: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.7)",
  },
  steps: {
    marginTop: 32,
  },
  stepCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepCardSpacing: {
    marginTop: 12,
  },
  stepText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.95)",
  },
  placeholderCard: {
    marginTop: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  placeholderText: {
    textAlign: "center",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
});
