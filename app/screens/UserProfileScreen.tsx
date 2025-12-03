import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NUTRITION_OPTIONS = [
  "Calories",
  "Protein",
  "Carbs",
  "Fat",
  "Fiber",
  "Sodium",
  "Potassium",
  "Sugar",
] as const;

type NutritionOption = (typeof NUTRITION_OPTIONS)[number];

export const UserProfileScreen = () => {
  const { session } = useAuth();
  const profileId = session?.user?.id ?? "dev-user";
  const [activeSection, setActiveSection] = useState<"Settings" | "Fragments">("Settings");
  const [nutritionOpen, setNutritionOpen] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<NutritionOption[]>(["Calories", "Protein"]);
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [allergies, setAllergies] = useState("");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [fragments, setFragments] = useState<Array<{ id: string; title: string; description: string | null }>>([]);
  const [fragmentsLoading, setFragmentsLoading] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(true);

  const toggleMetric = (metric: NutritionOption) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric],
    );
  };

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from("nutrition_preferences")
          .select("*")
          .eq("profile_id", profileId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const metricsFromDb = Array.isArray(data.metrics)
            ? (data.metrics as NutritionOption[])
            : [];
          setSelectedMetrics(metricsFromDb);
          setLikes(data.likes ?? "");
          setDislikes(data.dislikes ?? "");
          setAllergies(data.allergies ?? "");
        }
      } catch (error) {
        console.error(error);
        Alert.alert("Unable to load preferences", "Check that Supabase is running.");
      } finally {
        setPrefsLoading(false);
      }
    };

    const loadFragments = async () => {
      try {
        const { data, error } = await supabase
          .from("fragments")
          .select("*")
          .eq("profile_id", profileId)
          .order("inserted_at", { ascending: false });
        if (error) throw error;
        setFragments(data ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setFragmentsLoading(false);
      }
    };

    loadPreferences();
    loadFragments();
  }, [profileId]);

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    setSaveMessage(null);
    try {
      const payload = {
        profile_id: profileId,
        metrics: selectedMetrics,
        likes,
        dislikes,
        allergies,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("nutrition_preferences")
        .upsert(payload, { onConflict: "profile_id" });
      if (error) throw error;
      setSaveMessage("Preferences saved");
    } catch (error) {
      console.error(error);
      setSaveMessage("Could not save preferences");
    } finally {
      setIsSavingPrefs(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleAddFragment = async () => {
    try {
      const payload = {
        profile_id: profileId,
        title: `Fragment ${fragments.length + 1}`,
        description: "Describe this fragment",
      };
      const { data, error } = await supabase.from("fragments").insert(payload).select().single();
      if (error) throw error;
      setFragments((prev) => [data, ...prev]);
    } catch (error) {
      console.error(error);
      Alert.alert("Unable to add fragment", "Check Supabase connection.");
    }
  };

  const sectionContent = useMemo(() => {
    if (activeSection === "Fragments") {
      return (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Fragments</Text>
          <Text style={styles.sectionHeading}>Fragment presets</Text>
          <Text style={styles.helperText}>
            Use this space to save favorite pantry or recipe fragments. Hook this into Supabase later.
          </Text>
          {fragmentsLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color="#0fb06a" />
              <Text style={styles.loadingText}>Loading fragments...</Text>
            </View>
          ) : fragments.length ? (
            <View style={styles.fragmentPillRow}>
              {fragments.map((fragment) => (
                <View key={fragment.id} style={styles.fragmentPill}>
                  <Text style={styles.fragmentPillText}>{fragment.title}</Text>
                  {fragment.description ? (
                    <Text style={styles.fragmentDescription}>{fragment.description}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>No fragments saved yet.</Text>
          )}
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAddFragment}>
            <Text style={styles.secondaryButtonText}>Create new fragment</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (prefsLoading) {
      return (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Loading profile</Text>
          <View style={styles.loadingState}>
            <ActivityIndicator color="#0fb06a" />
            <Text style={styles.loadingText}>Fetching preferences…</Text>
          </View>
        </View>
      );
    }

    return (
      <>
        <View style={styles.card}>
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setNutritionOpen((prev) => !prev);
            }}
            style={styles.dropdownHeader}
          >
            <Text style={styles.sectionLabel}>Nutrition preferences</Text>
            <Text style={styles.caret}>{nutritionOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {nutritionOpen ? (
            <View style={styles.optionList}>
              {NUTRITION_OPTIONS.map((option) => {
                const isSelected = selectedMetrics.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => toggleMetric(option)}
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                    ]}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxFilled]}>
                      {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.optionLabel}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Likes</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Citrus, roasted veggies, breakfast tacos"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={likes}
              onChangeText={setLikes}
              multiline
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Dislikes</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Mushrooms, overly sweet sauces"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={dislikes}
              onChangeText={setDislikes}
              multiline
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Allergies</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Tree nuts, dairy, shellfish"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={allergies}
              onChangeText={setAllergies}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.secondaryButton, isSavingPrefs && styles.disabledButton]}
            onPress={handleSavePreferences}
            disabled={isSavingPrefs || prefsLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {isSavingPrefs ? "Saving..." : "Save preferences"}
            </Text>
          </TouchableOpacity>
          {saveMessage ? <Text style={styles.statusText}>{saveMessage}</Text> : null}
        </View>
      </>
    );
  }, [
    activeSection,
    nutritionOpen,
    selectedMetrics,
    likes,
    dislikes,
    allergies,
    fragments,
    fragmentsLoading,
    isSavingPrefs,
    saveMessage,
    prefsLoading,
  ]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Text style={styles.title}>User profile</Text>
      <View style={styles.segment}>
        {["Settings", "Fragments"].map((tab) => {
          const isActive = activeSection === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentButton, isActive && styles.segmentActive]}
              onPress={() => setActiveSection(tab as "Settings" | "Fragments")}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {sectionContent}
      <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
      {session?.user?.email ? (
        <Text style={styles.sessionHint}>Signed in as {session.user.email}</Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 64,
    flexGrow: 1,
    backgroundColor: "#050505",
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
  },
  segment: {
    flexDirection: "row",
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: "#0f1420",
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#1b2337",
  },
  segmentText: {
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  card: {
    marginTop: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0b1120",
    padding: 20,
  },
  sectionLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.55)",
  },
  sectionHeading: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
  helperText: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  caret: {
    color: "rgba(255,255,255,0.6)",
  },
  optionList: {
    marginTop: 12,
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionRowSelected: {
    borderColor: "#0fb06a",
    backgroundColor: "rgba(15,176,106,0.15)",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxFilled: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  checkboxMark: {
    color: "#050505",
    fontWeight: "700",
    fontSize: 12,
  },
  optionLabel: {
    color: "#ffffff",
    fontSize: 14,
  },
  inputGroup: {
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 6,
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    backgroundColor: "#050911",
    minHeight: 60,
    textAlignVertical: "top",
  },
  fragmentPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  fragmentPill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 14,
    backgroundColor: "#080c18",
  },
  fragmentPillText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  fragmentDescription: {
    marginTop: 4,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 32,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#1b2335",
  },
  logoutText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  sessionHint: {
    marginTop: 8,
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
  },
  statusText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.6)",
  },
  loadingState: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 6,
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
  },
});
