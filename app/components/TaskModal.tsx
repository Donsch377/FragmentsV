import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { fetchAccessibleGroups } from "../utils/groups";

type TaskModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  defaultGroupId?: string | null;
};

type LinkedRecord = { id: string; name: string; group_name?: string | null };
type PickerMode = "date" | "time";
type PickerTarget = "start" | "due";
type PickerState = { target: PickerTarget; mode: PickerMode } | null;
type LinkTarget = "text" | "pantry" | "recipe";
type SelectorState = { mode: Exclude<LinkTarget, "text">; query: string } | null;

const LINK_TARGETS: { label: string; value: LinkTarget }[] = [
  { label: "Text", value: "text" },
  { label: "Pantry", value: "pantry" },
  { label: "Recipe", value: "recipe" },
];

export const TaskModal = ({ visible, onClose, onSaved, defaultGroupId }: TaskModalProps) => {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startDateValue, setStartDateValue] = useState<Date>(() => new Date());
  const [dueDateValue, setDueDateValue] = useState<Date | null>(null);
  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [linkTargets, setLinkTargets] = useState<Record<LinkTarget, boolean>>({
    text: true,
    pantry: false,
    recipe: false,
  });
  const [groupOptions, setGroupOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(defaultGroupId ?? null);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [linkNotes, setLinkNotes] = useState("");
  const [assigneesInput, setAssigneesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<string[]>([]);
  const [pantrySuggestions, setPantrySuggestions] = useState<LinkedRecord[]>([]);
  const [recipeSuggestions, setRecipeSuggestions] = useState<LinkedRecord[]>([]);
  const [selectedPantry, setSelectedPantry] = useState<LinkedRecord | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<LinkedRecord | null>(null);
  const [selectorState, setSelectorState] = useState<SelectorState>(null);
  const selectedGroupName = useMemo(() => {
    const match = groupOptions.find((option) => option.id === selectedGroupId);
    return match?.name ?? "";
  }, [groupOptions, selectedGroupId]);

  const assigneeList = useMemo(
    () =>
      assigneesInput
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    [assigneesInput],
  );

  const assigneeMatches = useMemo(() => {
    if (!assigneeSuggestions.length) return [];
    const query = assigneesInput.split(",").pop()?.trim().toLowerCase() ?? "";
    return assigneeSuggestions
      .filter((name) => (query ? name.toLowerCase().includes(query) : true))
      .filter((name) => !assigneeList.includes(name))
      .slice(0, 6);
  }, [assigneeSuggestions, assigneesInput, assigneeList]);

  const startDateLabel = startDateValue.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTimeLabel = startDateValue.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dueDateLabel = dueDateValue
    ? dueDateValue.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : "Pick due date";
  const dueTimeLabel = dueDateValue
    ? dueDateValue.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Pick due time";

  const reset = () => {
    setTitle("");
    setNotes("");
    setStartDateValue(new Date());
    setDueDateValue(null);
    setLinkTargets({ text: true, pantry: false, recipe: false });
    setLinkNotes("");
    setAssigneesInput("");
    setSelectedPantry(null);
    setSelectedRecipe(null);
    setPickerState(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    setStartDateValue(new Date());
    setDueDateValue(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setGroupMenuOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const loadGroups = async () => {
      const options = await fetchAccessibleGroups(session?.user?.id);
      setGroupOptions(options);
      setSelectedGroupId((prev) => {
        if (prev && options.some((option) => option.id === prev)) return prev;
        if (defaultGroupId && options.some((option) => option.id === defaultGroupId)) {
          return defaultGroupId;
        }
        return options[0]?.id ?? null;
      });
    };
    loadGroups();
  }, [visible, session?.user?.id, defaultGroupId]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    if (!selectedGroupId) {
      setPantrySuggestions([]);
      setRecipeSuggestions([]);
    }
    const loadAssigneesAndLinks = async () => {
      try {
        const names = new Set<string>();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, email")
            .eq("id", session.user.id)
            .maybeSingle();
          const label = profile?.display_name || session.user.user_metadata?.full_name || session.user.email || "You";
          names.add(label);
        }
        if (selectedGroupId) {
          const { data: memberRows, error: membersError } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", selectedGroupId);
          if (membersError) throw membersError;
          const memberIds = memberRows?.map((row) => row.user_id).filter(Boolean);
          if (memberIds?.length) {
            const { data: profiles, error: profilesError } = await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", memberIds);
            if (profilesError) throw profilesError;
            profiles?.forEach((profile) => {
              const label = profile.display_name || profile.id?.slice(0, 8) || "Member";
              names.add(label);
            });
          }
        }
        if (!cancelled) {
          setAssigneeSuggestions(Array.from(names));
        }
      } catch (error) {
        console.error("Failed to load assignee suggestions", error);
      }

      try {
        if (!selectedGroupId) {
          if (!cancelled) {
            setPantrySuggestions([]);
            setRecipeSuggestions([]);
          }
          return;
        }
        const [{ data: foods, error: foodError }, { data: recipes, error: recipeError }] = await Promise.all([
          supabase
            .from("group_foods")
            .select("food:foods(id, name, group_name)")
            .eq("group_id", selectedGroupId)
            .order("inserted_at", { ascending: false })
            .limit(50),
          supabase
            .from("group_recipes")
            .select("recipe:recipes(id, name)")
            .eq("group_id", selectedGroupId)
            .order("inserted_at", { ascending: false })
            .limit(50),
        ]);
        if (foodError) throw foodError;
        if (recipeError) throw recipeError;
        if (!cancelled) {
          const pantryRecords =
            foods
              ?.map((entry: any) => entry.food)
              .filter((item: LinkedRecord | null): item is LinkedRecord => Boolean(item))
              .map((item) => ({
                ...item,
                group_name: item.group_name ?? selectedGroupName,
              })) ?? [];
          const recipeRecords =
            recipes
              ?.map((entry: any) => entry.recipe)
              .filter((item: LinkedRecord | null): item is LinkedRecord => Boolean(item)) ?? [];
          setPantrySuggestions(pantryRecords);
          setRecipeSuggestions(recipeRecords);
        }
      } catch (error) {
        console.error("Failed to load pantry/recipe suggestions", error);
      }
    };
    loadAssigneesAndLinks();
    return () => {
      cancelled = true;
    };
  }, [visible, selectedGroupId, session?.user?.id, selectedGroupName]);

  useEffect(() => {
    setSelectedPantry(null);
    setSelectedRecipe(null);
  }, [selectedGroupId]);

  useEffect(() => {
    if (!linkTargets.pantry) {
      setSelectedPantry(null);
    }
    if (!linkTargets.recipe) {
      setSelectedRecipe(null);
    }
    if (!linkTargets.text) {
      setLinkNotes("");
    }
  }, [linkTargets]);

  const toggleLinkTarget = (target: LinkTarget) => {
    setLinkTargets((prev) => ({ ...prev, [target]: !prev[target] }));
  };

  const openPicker = (target: PickerTarget, mode: PickerMode) => {
    setPickerState({ target, mode });
  };

  const applySelection = (target: PickerTarget, mode: PickerMode, selected: Date) => {
    const updater = target === "start" ? setStartDateValue : setDueDateValue;
    const baseValue =
      target === "start"
        ? startDateValue
        : dueDateValue ?? new Date(startDateValue.getTime());
    const next = new Date(baseValue);
    if (mode === "date") {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    updater(next);
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") {
      if (Platform.OS === "android") {
        setPickerState(null);
      }
      return;
    }
    const currentPicker = pickerState;
    if (Platform.OS === "android") {
      setPickerState(null);
    }
    if (!currentPicker || !selected) return;
    applySelection(currentPicker.target, currentPicker.mode, selected);
  };

  const handleAddAssignee = (name: string) => {
    const unique = Array.from(new Set([...assigneeList, name]));
    setAssigneesInput(unique.join(", "));
  };

  const openSelector = (mode: Exclude<LinkTarget, "text">) => {
    if (!selectedGroupId) {
      Alert.alert("Select a group", "Choose which group this task belongs to before linking items.");
      return;
    }
    setSelectorState({ mode, query: "" });
  };

  const closeSelector = () => setSelectorState(null);

  const handleSelectRecord = (record: LinkedRecord) => {
    if (!selectorState) return;
    if (selectorState.mode === "pantry") {
      setSelectedPantry(record);
    } else {
      setSelectedRecipe(record);
    }
    closeSelector();
  };

  const currentSelectorOptions = selectorState
    ? (selectorState.mode === "pantry" ? pantrySuggestions : recipeSuggestions)
    : [];
  const selectorFiltered = selectorState
    ? currentSelectorOptions.filter((item) =>
        item.name.toLowerCase().includes(selectorState.query.toLowerCase()),
      )
    : [];

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Task title required", "Please add a task name.");
      return;
    }
    const groupId = selectedGroupId ?? defaultGroupId ?? groupOptions[0]?.id ?? null;
    if (!groupId) {
      Alert.alert("Select a group", "Tasks need to be associated with a group before saving.");
      return;
    }
    if (linkTargets.pantry && !selectedPantry) {
      Alert.alert("Select pantry item", "Choose the pantry item to link.");
      return;
    }
    if (linkTargets.recipe && !selectedRecipe) {
      Alert.alert("Select recipe", "Choose the recipe to link.");
      return;
    }

    const startAt = startDateValue.toISOString();
    const startDate = startAt.split("T")[0];
    const dueSource = dueDateValue ? new Date(dueDateValue) : new Date(startDateValue);
    const dueAt = dueSource.toISOString();
    const dueDate = dueAt.split("T")[0];
    const activeLinkTypes = LINK_TARGETS.filter((option) => linkTargets[option.value]).map((option) => option.value);

    try {
      setSaving(true);
      const payload: Record<string, any> = {
        title: title.trim(),
        notes: notes.trim() || null,
        start_date: startDate,
        start_at: startAt,
        due_date: dueDate,
        due_at: dueAt,
        link_type: activeLinkTypes.length ? activeLinkTypes.join(",") : null,
        linked_text: linkTargets.text ? linkNotes.trim() || null : null,
        group_id: groupId,
        linked_food_id: linkTargets.pantry ? selectedPantry?.id ?? null : null,
        linked_recipe_id: linkTargets.recipe ? selectedRecipe?.id ?? null : null,
      };
      if (assigneeList.length) {
        payload.assignee_names = assigneeList;
      }
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;
      reset();
      await onSaved();
      onClose();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Unable to save task", error.message ?? "Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  const pickerValue = pickerState
    ? pickerState.target === "start"
      ? startDateValue
      : dueDateValue ?? new Date(startDateValue.getTime())
    : new Date();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} presentationStyle="overFullScreen" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 32 : 0}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Create task</Text>
              <TextInput
                style={styles.input}
                placeholder="Task title"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Notes (optional)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              <Text style={styles.sectionLabel}>Assign to group</Text>
              {groupOptions.length ? (
                <View style={styles.selectionBlock}>
                  <TouchableOpacity
                    style={[styles.selectionButton, styles.selectionButtonRow]}
                    onPress={() => setGroupMenuOpen((prev) => !prev)}
                    disabled={!groupOptions.length}
                  >
                    <Text style={styles.selectionButtonText}>
                      {selectedGroupName || "Choose a group"}
                    </Text>
                    <Text style={styles.selectionCaret}>{groupMenuOpen ? "▲" : "▼"}</Text>
                  </TouchableOpacity>
                  {groupMenuOpen ? (
                    <View style={styles.groupDropdown}>
                      {groupOptions.map((group) => {
                        const active = group.id === selectedGroupId;
                        return (
                          <TouchableOpacity
                            key={group.id}
                            style={[styles.groupDropdownItem, active && styles.groupDropdownItemActive]}
                            onPress={() => {
                              setSelectedGroupId(group.id);
                              setGroupMenuOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.groupDropdownLabel,
                                active && styles.groupDropdownLabelActive,
                              ]}
                            >
                              {group.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.helperText}>Create a group from the Groups tab to start assigning tasks.</Text>
              )}

              <Text style={styles.sectionLabel}>Start window</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.input, styles.inputHalf, styles.selector]} onPress={() => openPicker("start", "date")}>
                  <Text style={styles.selectorLabel}>{startDateLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.input, styles.inputHalf, styles.selector]} onPress={() => openPicker("start", "time")}>
                  <Text style={styles.selectorLabel}>{startTimeLabel}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Due window</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.input, styles.inputHalf, styles.selector]} onPress={() => openPicker("due", "date")}>
                  <Text style={styles.selectorLabel}>{dueDateLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, styles.inputHalf, styles.selector, !dueDateValue && styles.selectorDisabled]}
                  onPress={() => dueDateValue && openPicker("due", "time")}
                  disabled={!dueDateValue}
                >
                  <Text style={styles.selectorLabel}>{dueTimeLabel}</Text>
                </TouchableOpacity>
              </View>
              {dueDateValue ? (
                <TouchableOpacity style={styles.clearRow} onPress={() => setDueDateValue(null)}>
                  <Text style={styles.clearRowText}>Clear due date</Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.sectionLabel}>Link content</Text>
              <View style={styles.chipRow}>
                {LINK_TARGETS.map((option) => {
                  const active = linkTargets[option.value];
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleLinkTarget(option.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {linkTargets.text ? (
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Task context"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  value={linkNotes}
                  onChangeText={setLinkNotes}
                />
              ) : null}

              {linkTargets.pantry ? (
                <View style={styles.selectionBlock}>
                  <Text style={styles.selectionLabel}>Pantry item</Text>
                  <TouchableOpacity style={styles.selectionButton} onPress={() => openSelector("pantry")}>
                    <Text style={styles.selectionButtonText}>
                      {selectedPantry ? selectedPantry.name : "Choose pantry item"}
                    </Text>
                    {selectedPantry?.group_name ? (
                      <Text style={styles.selectionMeta}>{selectedPantry.group_name}</Text>
                    ) : null}
                  </TouchableOpacity>
                  {selectedPantry ? (
                    <TouchableOpacity onPress={() => setSelectedPantry(null)}>
                      <Text style={styles.clearRowText}>Clear selection</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {linkTargets.recipe ? (
                <View style={styles.selectionBlock}>
                  <Text style={styles.selectionLabel}>Recipe</Text>
                  <TouchableOpacity style={styles.selectionButton} onPress={() => openSelector("recipe")}>
                    <Text style={styles.selectionButtonText}>
                      {selectedRecipe ? selectedRecipe.name : "Choose recipe"}
                    </Text>
                  </TouchableOpacity>
                  {selectedRecipe ? (
                    <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
                      <Text style={styles.clearRowText}>Clear selection</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <TextInput
                style={styles.input}
                placeholder="Assign to (comma separated)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={assigneesInput}
                onChangeText={setAssigneesInput}
              />
              {assigneeMatches.length ? (
                <View style={styles.suggestionList}>
                  {assigneeMatches.map((name, index) => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.suggestionItem, index === assigneeMatches.length - 1 && styles.suggestionItemLast]}
                      onPress={() => handleAddAssignee(name)}
                    >
                      <Text style={styles.suggestionText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity style={[styles.primaryButton, saving && { opacity: 0.4 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Create task"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      {pickerState ? (
        Platform.OS === "ios" ? (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={pickerValue}
              mode={pickerState.mode}
              display="spinner"
              minuteInterval={5}
              onChange={handlePickerChange}
            />
            <TouchableOpacity style={styles.pickerDoneButton} onPress={() => setPickerState(null)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <DateTimePicker
            value={pickerValue}
            mode={pickerState.mode}
            display="default"
            minuteInterval={5}
            onChange={handlePickerChange}
          />
        )
      ) : null}

      {selectorState ? (
        <Modal animationType="fade" transparent visible presentationStyle="overFullScreen" statusBarTranslucent>
          <TouchableWithoutFeedback onPress={closeSelector}>
            <View style={styles.selectorBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.selectorSheet}>
                  <Text style={styles.selectorTitle}>
                    {selectorState.mode === "pantry" ? "Select pantry item" : "Select recipe"}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.selectorInput]}
                    placeholder="Search"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={selectorState.query}
                    onChangeText={(text) => setSelectorState((prev) => (prev ? { ...prev, query: text } : prev))}
                  />
                  <ScrollView style={{ maxHeight: 320 }}>
                    {selectorFiltered.length === 0 ? (
                      <Text style={styles.selectorEmpty}>No matches</Text>
                    ) : (
                      selectorFiltered.map((record) => (
                        <TouchableOpacity
                          key={record.id}
                          style={styles.selectorItem}
                          onPress={() => handleSelectRecord(record)}
                        >
                          <Text style={styles.selectorItemText}>{record.name}</Text>
                          {record.group_name ? (
                            <Text style={styles.selectorItemMeta}>{record.group_name}</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: "#050810",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingTop: 20,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
    backgroundColor: "#080f1a",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  selector: {
    justifyContent: "center",
  },
  selectorLabel: {
    color: "#ffffff",
    fontSize: 16,
  },
  selectorDisabled: {
    opacity: 0.4,
  },
  sectionLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chipActive: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  chipText: {
    color: "#f0f0f0",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#050810",
  },
  clearRow: {
    marginTop: -4,
    marginBottom: 4,
  },
  clearRowText: {
    color: "#f87171",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#0fb06a",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  primaryButtonText: {
    textAlign: "center",
    color: "#050505",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    textAlign: "center",
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    fontWeight: "500",
  },
  suggestionList: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    color: "#fefefe",
    fontSize: 15,
  },
  pickerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#050505",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingTop: 8,
    paddingBottom: 20,
  },
  pickerDoneButton: {
    marginTop: 6,
    alignItems: "center",
    paddingVertical: 8,
  },
  pickerDoneText: {
    color: "#0fb06a",
    fontWeight: "600",
    fontSize: 16,
  },
  selectionBlock: {
    gap: 6,
  },
  selectionLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  selectionButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#080f1a",
  },
  selectionButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionButtonText: {
    color: "#ffffff",
    fontSize: 16,
  },
  selectionCaret: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  groupDropdown: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#0b1220",
  },
  groupDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupDropdownItemActive: {
    backgroundColor: "rgba(15,176,106,0.15)",
  },
  groupDropdownLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
  },
  groupDropdownLabelActive: {
    color: "#0fb06a",
    fontWeight: "600",
  },
  helperText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  selectionMeta: {
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  selectorBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  selectorSheet: {
    backgroundColor: "#050810",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  selectorInput: {
    backgroundColor: "#0a111f",
  },
  selectorEmpty: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    paddingVertical: 20,
  },
  selectorItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  selectorItemText: {
    color: "#ffffff",
    fontSize: 16,
  },
  selectorItemMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
});
