import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAiPreferences, type LlmProvider } from "../providers/AiPreferencesProvider";
import { DEFAULT_ON_DEVICE_MODEL, ON_DEVICE_MODEL_MAP, type OnDeviceModelKey } from "../constants/onDeviceModels";
import { CHAT_RESPONSE_MODES, type ChatResponseMode } from "../constants/aiConfig";
import { useExecModel, EMPTY_EXEC_MODEL } from "../hooks/useExecModel";
import { isAppleLLMSupported } from "../lib/appleBridge";

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
  const {
    textProvider,
    setTextProvider,
    imageProvider,
    setImageProvider,
    modelKey,
    setModelKey,
    chatMode,
    setChatMode,
  } = useAiPreferences();
  const [activeSection, setActiveSection] = useState<"Settings" | "Fragments">("Settings");
  const [nutritionOpen, setNutritionOpen] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<NutritionOption[]>([]);
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [allergies, setAllergies] = useState("");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [fragments, setFragments] = useState<Array<{ id: string; title: string; description: string | null }>>([]);
  const [fragmentsLoading, setFragmentsLoading] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const isIOS = Platform.OS === "ios";
  const aiOptions = useMemo(
    () => [
      {
        key: "openSource" as LlmProvider,
        title: "Download to device (ExecuTorch)",
        description: "Streams Meta/Qwen models through react-native-executorch. First response downloads the weights to your phone.",
        footnote: "Best privacy. Requires running the new architecture build (expo run:*).",
        disabled: false,
      },
      {
        key: "apple" as LlmProvider,
        title: "Apple on-device",
        description: "Use Apple Intelligence APIs (AIPromptSession/CoreLLM) when they become available on your device.",
        footnote: !isIOS
          ? "Available on iOS only."
          : !isAppleLLMSupported
              ? "Requires iOS 18+ with Apple Intelligence enabled."
              : "Falls back to the ExecuTorch provider until Apple Intelligence ships.",
        disabled: !isIOS || !isAppleLLMSupported,
      },
    ],
    [isIOS, isAppleLLMSupported],
  );

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

  const handleTextProviderSelect = useCallback(
    (next: LlmProvider) => {
      if (next === textProvider) return;
      void setTextProvider(next);
    },
    [setTextProvider, textProvider],
  );

  const handleImageProviderSelect = useCallback(
    (next: LlmProvider) => {
      if (next === imageProvider) return;
      void setImageProvider(next);
    },
    [imageProvider, setImageProvider],
  );

  const handleModelSelect = useCallback(
    (key: OnDeviceModelKey) => {
      if (key === modelKey) return;
      void setModelKey(key);
    },
    [modelKey, setModelKey],
  );

  const handleChatModeSelect = useCallback(
    (mode: ChatResponseMode) => {
      if (mode === chatMode) return;
      void setChatMode(mode);
    },
    [chatMode, setChatMode],
  );

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
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>AI</Text>
          <Text style={styles.sectionHeading}>Text assistant routing</Text>
          <Text style={styles.helperText}>
            Choose how Fragments answers non-command chat messages. Both options keep prompts fully local and request a
            4K context window for better accuracy.
          </Text>
          <View style={styles.aiOptionGrid}>
            {aiOptions.map((option) => {
              const isActive = textProvider === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.aiOptionCard,
                    isActive && styles.aiOptionCardActive,
                    option.disabled && styles.aiOptionCardDisabled,
                  ]}
                  onPress={() => handleTextProviderSelect(option.key)}
                  disabled={option.disabled}
                >
                  <Text style={styles.aiOptionLabel}>{option.title}</Text>
                  <Text style={styles.aiOptionDescription}>{option.description}</Text>
                  <Text style={styles.aiOptionFootnote}>{option.footnote}</Text>
                  {isActive ? <Text style={styles.aiOptionBadge}>Selected</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {textProvider === "openSource" ? (
            <>
              <View style={styles.aiModelGrid}>
                {Object.entries(ON_DEVICE_MODEL_MAP).map(([key, model]) => {
                  const typedKey = key as OnDeviceModelKey;
                  const isActive = modelKey === typedKey;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.aiOptionCard, isActive && styles.aiOptionCardActive]}
                      onPress={() => handleModelSelect(typedKey)}
                    >
                      <Text style={styles.aiOptionLabel}>{model.label}</Text>
                      <Text style={styles.aiOptionDescription}>{model.description}</Text>
                      <Text style={styles.aiOptionFootnote}>
                        {model.size} • {model.contextWindow.toLocaleString()} token window
                      </Text>
                      {isActive ? <Text style={styles.aiOptionBadge}>Selected</Text> : null}
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.capsuleHint}>
                  Models download the first time you use the AI tab and live inside the device sandbox. Remove the app to
                  clear them.
                </Text>
              </View>
              <OnDeviceDownloadPanel modelKey={modelKey} />
            </>
          ) : (
            <Text style={styles.helperText}>
              Apple&apos;s path expects you to wire up AIPromptSession/CoreLLM (or a similar bridge) inside the native
              project so prompts never leave the phone.
            </Text>
          )}
          <View style={styles.aiDivider} />
          <Text style={styles.sectionHeading}>Image generation</Text>
          <Text style={styles.helperText}>
            Pick how product art is generated when you tap Image Playground inside pantry forms.
          </Text>
          <View style={styles.aiOptionGrid}>
            {aiOptions.map((option) => {
              const isActive = imageProvider === option.key;
              return (
                <TouchableOpacity
                  key={`${option.key}-image`}
                  style={[
                    styles.aiOptionCard,
                    isActive && styles.aiOptionCardActive,
                    option.disabled && styles.aiOptionCardDisabled,
                  ]}
                  onPress={() => handleImageProviderSelect(option.key)}
                  disabled={option.disabled}
                >
                  <Text style={styles.aiOptionLabel}>{option.title}</Text>
                  <Text style={styles.aiOptionDescription}>{option.description}</Text>
                  <Text style={styles.aiOptionFootnote}>{option.footnote}</Text>
                  {isActive ? <Text style={styles.aiOptionBadge}>Selected</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {imageProvider === "apple" ? (
            <Text style={styles.helperText}>
              Image Playground runs fully on-device on iOS 18.4+. We save the generated files locally before uploading to
              Supabase.
            </Text>
          ) : (
            <Text style={styles.helperText}>
              Switch to Apple to unlock Image Playground ideas, or upload photos manually for now.
            </Text>
          )}
          <View style={styles.responseModeBlock}>
            <Text style={styles.sectionLabel}>Response length</Text>
            <Text style={styles.helperText}>
              Choose how verbose Local AI replies should be while chatting. Long answers request more on-device tokens.
            </Text>
            <View style={styles.responseModeRow}>
              {Object.values(CHAT_RESPONSE_MODES).map((mode) => {
                const isActive = chatMode === mode.key;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    style={[styles.responseModePill, isActive && styles.responseModePillActive]}
                    onPress={() => handleChatModeSelect(mode.key)}
                  >
                    <Text style={[styles.responseModeLabel, isActive && styles.responseModeLabelActive]}>{mode.label}</Text>
                    <Text style={styles.responseModeDescription}>{mode.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
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
    prefsLoading,
    aiOptions,
    textProvider,
    handleTextProviderSelect,
    handleModelSelect,
    handleChatModeSelect,
    modelKey,
    chatMode,
    imageProvider,
    handleImageProviderSelect,
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
      {activeSection === "Settings" ? (
        <View style={styles.saveFooter}>
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
      ) : null}
      <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
      {session?.user?.email ? (
        <Text style={styles.sessionHint}>Signed in as {session.user.email}</Text>
      ) : null}
    </ScrollView>
  );
};

const OnDeviceDownloadPanel = ({ modelKey }: { modelKey: OnDeviceModelKey }) => {
  const model = ON_DEVICE_MODEL_MAP[modelKey] ?? ON_DEVICE_MODEL_MAP[DEFAULT_ON_DEVICE_MODEL];
  const [downloadRequested, setDownloadRequested] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const execModel = useExecModel(model.resource, downloadRequested) ?? EMPTY_EXEC_MODEL;
  const downloadPercent = Math.round((execModel.downloadProgress || 0) * 100);
  const isDownloading = downloadRequested && !execModel.ready;
  const friendlyError =
    execModel.error && typeof execModel.error === "object" && "message" in execModel.error
      ? String((execModel.error as Error).message)
      : execModel.error
        ? String(execModel.error)
        : null;

  useEffect(() => {
    if (downloadRequested && execModel.ready) {
      setStatusMessage(`${model.label} downloaded to this device. You can chat right away.`);
      setDownloadRequested(false);
    }
  }, [downloadRequested, execModel.ready, model.label]);

  useEffect(() => {
    setDownloadRequested(false);
    setStatusMessage(null);
  }, [modelKey]);

  const handleStartDownload = () => {
    setStatusMessage(null);
    setDownloadRequested(true);
  };

  const handleCancel = () => {
    execModel.interrupt?.();
    setDownloadRequested(false);
  };

  return (
    <View style={styles.downloadCard}>
      <Text style={styles.sectionLabel}>Model download</Text>
      <Text style={styles.helperText}>
        Start the ExecuTorch download without opening the AI console. Keep Fragments in the foreground until it finishes.
      </Text>
      <TouchableOpacity
        style={[styles.downloadButton, (isDownloading || execModel.ready) && styles.downloadButtonDisabled]}
        onPress={handleStartDownload}
        disabled={isDownloading || execModel.ready}
      >
        <Text style={styles.downloadButtonText}>
          {isDownloading
            ? `Downloading… ${downloadPercent}%`
            : execModel.ready
                ? `${model.label} already installed`
                : `Download ${model.label}`}
        </Text>
      </TouchableOpacity>
      {isDownloading ? (
        <>
          <View style={styles.downloadProgressTrack}>
            <View style={[styles.downloadProgressFill, { width: `${downloadPercent}%` }]} />
          </View>
          <TouchableOpacity style={styles.downloadCancel} onPress={handleCancel}>
            <Text style={styles.downloadCancelText}>Cancel download</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
      {friendlyError ? <Text style={styles.statusText}>{friendlyError}</Text> : null}
    </View>
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
  aiOptionGrid: {
    marginTop: 16,
    gap: 12,
  },
  aiModelGrid: {
    marginTop: 16,
    gap: 12,
  },
  aiOptionCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#0d1324",
  },
  aiOptionCardActive: {
    borderColor: "#16a34a",
    backgroundColor: "rgba(22,163,74,0.12)",
  },
  aiOptionCardDisabled: {
    opacity: 0.5,
  },
  aiOptionLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  aiOptionDescription: {
    marginTop: 6,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 18,
  },
  aiOptionFootnote: {
    marginTop: 2,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  aiOptionBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    color: "#16a34a",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.6)",
    fontWeight: "600",
  },
  capsuleHint: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
  codeText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  responseModeBlock: {
    marginTop: 20,
    gap: 8,
  },
  responseModeRow: {
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
  },
  responseModePill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 12,
  },
  responseModePillActive: {
    borderColor: "#0fb06a",
    backgroundColor: "rgba(15,176,106,0.15)",
  },
  responseModeLabel: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  responseModeLabelActive: {
    color: "#0fb06a",
  },
  responseModeDescription: {
    marginTop: 4,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
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
  saveFooter: {
    marginTop: 32,
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
  aiDivider: {
    marginTop: 24,
    marginBottom: 12,
    borderBottomColor: "rgba(255,255,255,0.12)",
    borderBottomWidth: 1,
  },
  downloadCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#10162b",
    gap: 12,
  },
  downloadButton: {
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: "#1f2a44",
    alignItems: "center",
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  downloadProgressTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  downloadProgressFill: {
    height: "100%",
    backgroundColor: "#0fb06a",
  },
  downloadCancel: {
    alignSelf: "flex-start",
  },
  downloadCancelText: {
    color: "#f97316",
    fontWeight: "600",
  },
});
