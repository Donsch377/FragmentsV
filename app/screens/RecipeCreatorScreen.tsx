import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type {
  RecipeDatabox,
  RecipeDefinition,
  RecipeIngredient,
  RecipeNutritionKey,
  RecipeNutritionField,
  RecipeStep,
  RecipeStepIngredientUsage,
  RecipeStepDataboxValue,
} from "../types/recipes";
import { evaluateDataboxes } from "../utils/databoxEvaluator";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { ensureGroupMembership, fetchAccessibleGroups } from "../utils/groups";
import { captureAuthDebugSnapshot, type AuthDebugSnapshot } from "../utils/authDebug";

type PantryFoodOption = {
  id: string;
  name: string;
};

type RecipeCreatorDraft = {
  title: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  groupId?: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition: RecipeNutritionField[];
  databoxes: RecipeDatabox[];
};

type RecipeCreatorRouteParams = {
  groupId?: string | null;
  initialRecipe?: RecipeCreatorDraft | null;
};

type RecipeCreatorRoute = RouteProp<{ RecipeCreator: RecipeCreatorRouteParams }, "RecipeCreator">;

const createId = () => Math.random().toString(36).slice(2, 9);

const NUTRITION_OPTIONS: { key: RecipeNutritionKey; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];

export const RecipeCreatorScreen = () => {
  const route = useRoute<RecipeCreatorRoute>();
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [nutritionFields, setNutritionFields] = useState<RecipeNutritionField[]>([]);
  const [databoxes, setDataboxes] = useState<RecipeDatabox[]>([]);
  const [savedRecipe, setSavedRecipe] = useState<RecipeDefinition | null>(null);
  const [savedDataboxResults, setSavedDataboxResults] = useState<Record<string, number>>({});
  const [groupOptions, setGroupOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(route.params?.groupId ?? null);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialRecipeDraft = route.params?.initialRecipe;

  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>({});
  const [pantryOptions, setPantryOptions] = useState<PantryFoodOption[]>([]);
  const [linkingIngredientId, setLinkingIngredientId] = useState<string | null>(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);

  const servingsNumber = Number(servings) || 0;
  const prepMinutes = Number(prepTime) || 0;
  const cookMinutes = Number(cookTime) || 0;

  const databoxPreview = useMemo(() => {
    if (!databoxes.length) return {};
    return evaluateDataboxes(databoxes, {
      servings: servingsNumber,
      prepTimeMinutes: prepMinutes,
      cookTimeMinutes: cookMinutes,
    });
  }, [databoxes, cookMinutes, prepMinutes, servingsNumber]);

  const selectedGroupName = useMemo(() => {
    const match = groupOptions.find((option) => option.id === selectedGroupId);
    return match?.name ?? "";
  }, [groupOptions, selectedGroupId]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const loadGroups = async () => {
      const options = await fetchAccessibleGroups(session.user?.id);
      setGroupOptions(options);
      setSelectedGroupId((prev) => {
        if (route.params?.groupId) return route.params.groupId;
        if (prev && options.some((option) => option.id === prev)) return prev;
        return options[0]?.id ?? null;
      });
    };
    loadGroups();
  }, [session?.user?.id, route.params?.groupId]);

  useEffect(() => {
    const loadPantryFoods = async () => {
      if (!selectedGroupId || !session?.user?.id) {
        setPantryOptions([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("group_foods")
          .select("id, food:foods(id, name)")
          .eq("group_id", selectedGroupId)
          .order("inserted_at", { ascending: false });
        if (error) throw error;
        const items: PantryFoodOption[] =
          data
            ?.map((row: any) => {
              if (!row.food) return null;
              return { id: row.food.id as string, name: row.food.name as string };
            })
            .filter(Boolean) ?? [];
        setPantryOptions(items);
      } catch (error) {
        console.error("Failed to load pantry foods for recipe linking", error);
        setPantryOptions([]);
      }
    };
    loadPantryFoods();
  }, [selectedGroupId, session?.user?.id]);

  useEffect(() => {
    if (!initialRecipeDraft) return;
    setTitle(initialRecipeDraft.title ?? "");
    setPrepTime(
      initialRecipeDraft.prepTimeMinutes !== undefined && initialRecipeDraft.prepTimeMinutes !== null
        ? String(initialRecipeDraft.prepTimeMinutes)
        : "",
    );
    setCookTime(
      initialRecipeDraft.cookTimeMinutes !== undefined && initialRecipeDraft.cookTimeMinutes !== null
        ? String(initialRecipeDraft.cookTimeMinutes)
        : "",
    );
    setServings(
      initialRecipeDraft.servings !== undefined && initialRecipeDraft.servings !== null
        ? String(initialRecipeDraft.servings)
        : "",
    );
    setIngredients(initialRecipeDraft.ingredients ?? []);
    setSteps(initialRecipeDraft.steps ?? []);
    setNutritionFields(initialRecipeDraft.nutrition ?? []);
    setDataboxes(initialRecipeDraft.databoxes ?? []);
    if (initialRecipeDraft.groupId) {
      setSelectedGroupId(initialRecipeDraft.groupId);
    }
  }, [initialRecipeDraft]);

  const addIngredient = () => {
    const newIngredient: RecipeIngredient = {
      id: createId(),
      label: "",
      amount: "",
      unit: "",
      linkedFoodId: "",
    };
    setIngredients((prev) => [...prev, newIngredient]);
  };

  const updateIngredient = (id: string, patch: Partial<RecipeIngredient>) => {
    setIngredients((prev) => prev.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)));
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
    setSteps((prev) =>
      prev.map((step) => ({
        ...step,
        ingredientUsages: step.ingredientUsages.filter((usage) => usage.ingredientId !== id),
      })),
    );
  };

  const addStep = () => {
    const newStep: RecipeStep = {
      id: createId(),
      summary: "",
      requires: [],
      ingredientUsages: [],
      databoxValues: [],
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const updateStep = (id: string, patch: Partial<RecipeStep>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };

  const toggleStepDependency = (stepId: string, dependencyId: string) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        const exists = step.requires.includes(dependencyId);
        return {
          ...step,
          requires: exists
            ? step.requires.filter((req) => req !== dependencyId)
            : [...step.requires, dependencyId],
        };
      }),
    );
  };

  const toggleStepIngredientUsage = (stepId: string, ingredientId: string) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        const usageExists = step.ingredientUsages.find((usage) => usage.ingredientId === ingredientId);
        if (usageExists) {
          return {
            ...step,
            ingredientUsages: step.ingredientUsages.filter((usage) => usage.ingredientId !== ingredientId),
          };
        }
        const newUsage: RecipeStepIngredientUsage = { ingredientId, amount: "" };
        return { ...step, ingredientUsages: [...step.ingredientUsages, newUsage] };
      }),
    );
  };

  const toggleStepExpanded = (stepId: string) => {
    setExpandedStepIds((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const updateStepIngredientUsage = (
    stepId: string,
    ingredientId: string,
    patch: Partial<RecipeStepIngredientUsage>,
  ) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          ingredientUsages: step.ingredientUsages.map((usage) =>
            usage.ingredientId === ingredientId ? { ...usage, ...patch } : usage,
          ),
        };
      }),
    );
  };

  const toggleStepDataboxReference = (stepId: string, databoxId: string) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        const exists = step.databoxValues.some((item) => item.databoxId === databoxId);
        if (exists) {
          return {
            ...step,
            databoxValues: step.databoxValues.filter((item) => item.databoxId !== databoxId),
          };
        }
        const value: RecipeStepDataboxValue = { databoxId, value: "" };
        return { ...step, databoxValues: [...step.databoxValues, value] };
      }),
    );
  };

  const updateStepDataboxValue = (stepId: string, databoxId: string, value: string) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          databoxValues: step.databoxValues.map((entry) =>
            entry.databoxId === databoxId ? { ...entry, value } : entry,
          ),
        };
      }),
    );
  };

  const toggleNutritionField = (option: (typeof NUTRITION_OPTIONS)[number]) => {
    setNutritionFields((prev) => {
      const existing = prev.find((field) => field.key === option.key);
      if (existing) {
        return prev.filter((field) => field.key !== option.key);
      }
      const newField: RecipeNutritionField = {
        id: createId(),
        key: option.key,
        label: option.label,
        unit: option.unit,
        estimatedValue: "",
      };
      return [...prev, newField];
    });
  };

  const updateNutritionValue = (id: string, value: string) => {
    setNutritionFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, estimatedValue: value } : field)),
    );
  };

  const addDatabox = () => {
    const newBox: RecipeDatabox = {
      id: createId(),
      label: `Databox ${databoxes.length + 1}`,
      defaultValue: "0",
      expression: "",
    };
    setDataboxes((prev) => [...prev, newBox]);
  };

  const updateDatabox = (id: string, patch: Partial<RecipeDatabox>) => {
    setDataboxes((prev) => prev.map((box) => (box.id === id ? { ...box, ...patch } : box)));
  };

  const removeDatabox = (id: string) => {
    setDataboxes((prev) => prev.filter((box) => box.id !== id));
    setSteps((prev) =>
      prev.map((step) => ({
        ...step,
        databoxValues: step.databoxValues.filter((entry) => entry.databoxId !== id),
      })),
    );
  };

  const handleSaveRecipe = async () => {
    if (!title.trim()) {
      Alert.alert("Name required", "Please give the recipe a title before saving.");
      return;
    }
    if (!servings.trim()) {
      Alert.alert("Servings required", "How many servings does this recipe make?");
      return;
    }
    if (!selectedGroupId) {
      Alert.alert("Choose a group", "Pick which group owns this recipe.");
      return;
    }

    if (!session?.user?.id) {
      Alert.alert("Sign in required", "You must be logged in before creating recipes.");
      return;
    }

    const context = {
      servings: servingsNumber,
      prepTimeMinutes: prepMinutes,
      cookTimeMinutes: cookMinutes,
    };
    const databoxValues = evaluateDataboxes(databoxes, context);

    const newRecipe: RecipeDefinition = {
      id: `recipe-${Date.now()}`,
      title: title.trim(),
      prepTimeMinutes: prepMinutes,
      cookTimeMinutes: cookMinutes,
      servings: servingsNumber || 1,
      createdAt: new Date().toISOString(),
      ingredients,
      steps,
      nutrition: nutritionFields,
      databoxes,
    };

    const instructionsPayload = {
      ingredients,
      steps,
      nutrition: nutritionFields,
      databoxes,
      databoxResults: databoxValues,
    };

    const payload = {
      name: title.trim(),
      summary: steps[0]?.summary || null,
      image_url: null,
      prep_time: prepTime.trim() || null,
      servings: servings.trim() || null,
      instructions: JSON.stringify(instructionsPayload),
      group_id: selectedGroupId,
    };

    let latestAuthSnapshot: AuthDebugSnapshot | null = null;

    try {
      setSaving(true);
      const membershipEnsured = await ensureGroupMembership(selectedGroupId);
      if (!membershipEnsured) {
        console.error("Could not ensure membership before recipe insert", {
          groupId: selectedGroupId,
          sessionUserId: session.user.id,
        });
        Alert.alert("Unable to join group", "Please try selecting the group again.");
        setSaving(false);
        return;
      }
      console.log("[RecipeCreator] Attempting recipe insert", {
        groupId: selectedGroupId,
        contextSessionUserId: session.user.id,
      });
      latestAuthSnapshot = await captureAuthDebugSnapshot("recipe-insert", selectedGroupId);
      const { data: recipeRow, error } = await supabase
        .from("recipes")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        if ((error as any)?.code === "42501") {
          console.error("[RLS] Recipe insert blocked", {
            groupId: selectedGroupId,
            contextSessionUserId: session.user.id,
            authSnapshot: latestAuthSnapshot,
            error,
          });
        }
        throw error;
      }
      await supabase
        .from("group_recipes")
        .upsert(
          {
            group_id: selectedGroupId,
            recipe_id: recipeRow.id,
            created_by: session?.user?.id ?? null,
          },
          { onConflict: "group_id,recipe_id" },
        );
      setSavedRecipe(newRecipe);
      setSavedDataboxResults(databoxValues);
      Alert.alert("Recipe saved", "View it in your pantry's recipe tab.");
    } catch (error: any) {
      if (error?.code === "42501") {
        console.error("[RLS] Recipe save blocked", {
          groupId: selectedGroupId,
          contextSessionUserId: session?.user?.id ?? null,
          authSnapshot: latestAuthSnapshot,
          error,
        });
      } else {
        console.error("Failed to save recipe", error);
      }
      Alert.alert("Unable to save recipe", error.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Recipe creator</Text>
        <Text style={styles.subtitle}>Define ingredients, steps, nutrition, and smart databoxes.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Assign to group</Text>
          {groupOptions.length ? (
            <>
              <TouchableOpacity
                style={styles.groupSelector}
                onPress={() => setGroupMenuOpen((prev) => !prev)}
                activeOpacity={0.9}
              >
                <Text style={styles.groupSelectorText}>
                  {selectedGroupName || "Choose a group"}
                </Text>
                <Text style={styles.groupSelectorCaret}>{groupMenuOpen ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {groupMenuOpen ? (
                <View style={styles.groupDropdown}>
                  {groupOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.groupDropdownItem,
                        selectedGroupId === option.id && styles.groupDropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedGroupId(option.id);
                        setGroupMenuOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.groupDropdownLabel,
                          selectedGroupId === option.id && styles.groupDropdownLabelActive,
                        ]}
                      >
                        {option.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.sectionSubheading}>
              You need a group or Solo pantry before saving a recipe.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Basic info</Text>
          <TextInput
            style={styles.input}
            placeholder="Recipe title"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Prep time (min)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="numeric"
              value={prepTime}
              onChangeText={setPrepTime}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Cook time (min)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="numeric"
              value={cookTime}
              onChangeText={setCookTime}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Servings"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="numeric"
            value={servings}
            onChangeText={setServings}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Ingredients</Text>
            <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
              <Text style={styles.addButtonText}>+ Add ingredient</Text>
            </TouchableOpacity>
          </View>
          {ingredients.length === 0 ? (
            <Text style={styles.emptyText}>No ingredients added yet.</Text>
          ) : null}
          {ingredients.map((ingredient) => (
            <View key={ingredient.id} style={styles.card}>
              {(() => {
                const linked = pantryOptions.find((item) => item.id === ingredient.linkedFoodId);
                const linkLabel = linked ? linked.name : "Link pantry item (optional)";
                return (
                  <>
              <View style={styles.cardHeader}>
                <TextInput
                  style={[styles.input, styles.cardTitleInput]}
                  placeholder="Ingredient name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={ingredient.label}
                  onChangeText={(text) => updateIngredient(ingredient.id, { label: text })}
                />
                <TouchableOpacity onPress={() => removeIngredient(ingredient.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Amount"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={ingredient.amount}
                  onChangeText={(text) => updateIngredient(ingredient.id, { amount: text })}
                />
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Unit"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={ingredient.unit}
                  onChangeText={(text) => updateIngredient(ingredient.id, { unit: text })}
                />
              </View>
              <TouchableOpacity
                style={styles.linkRow}
                activeOpacity={0.8}
                onPress={() => {
                  if (!selectedGroupId) {
                    Alert.alert("Select a group", "Choose a pantry group before linking ingredients.");
                    return;
                  }
                  setLinkingIngredientId(ingredient.id);
                  setLinkModalVisible(true);
                }}
              >
                <Ionicons
                  name="link-outline"
                  size={14}
                  color="rgba(255,255,255,0.6)"
                  style={styles.linkIcon}
                />
                <Text
                  style={[styles.linkLabel, linked && styles.linkLabelActive]}
                  numberOfLines={1}
                >
                  {linkLabel}
                </Text>
              </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Steps</Text>
            <TouchableOpacity style={styles.addButton} onPress={addStep}>
              <Text style={styles.addButtonText}>+ Add step</Text>
            </TouchableOpacity>
          </View>
          {steps.length === 0 ? <Text style={styles.emptyText}>No steps added yet.</Text> : null}
          {steps.map((step, index) => {
            const expanded = !!expandedStepIds[step.id];
            const selectedIngredientCount = step.ingredientUsages.length;
            const selectedDependencyCount = step.requires.length;
            const selectedDataboxCount = step.databoxValues.length;
            return (
              <View key={step.id} style={styles.card}>
                <Text style={styles.cardTitle}>Step {index + 1}</Text>
                <TextInput
                  style={[styles.input, styles.stepTitleInput]}
                  placeholder="Step title"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={step.summary}
                  onChangeText={(text) => updateStep(step.id, { summary: text })}
                />
                <TextInput
                  style={[styles.input, styles.stepDescriptionInput]}
                  placeholder="Detailed instructions (optional)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  value={step.notes ?? ""}
                  onChangeText={(text) => updateStep(step.id, { notes: text })}
                />

                <TouchableOpacity
                  style={styles.stepMetaRow}
                  activeOpacity={0.8}
                  onPress={() => toggleStepExpanded(step.id)}
                >
                  <Text style={styles.subheading}>Ingredients & timing</Text>
                  <Text style={styles.stepMetaText} numberOfLines={1}>
                    {selectedIngredientCount
                      ? `${selectedIngredientCount} ingredient${selectedIngredientCount === 1 ? "" : "s"}`
                      : "No ingredients"}
                    {steps.length > 1 && selectedDependencyCount
                      ? ` · ${selectedDependencyCount} dependency${selectedDependencyCount === 1 ? "" : "ies"}`
                      : ""}
                    {databoxes.length && selectedDataboxCount
                      ? ` · ${selectedDataboxCount} databox`
                      : ""}
                  </Text>
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>

                {expanded ? (
                  <>
                    <Text style={styles.subheading}>Uses ingredients</Text>
                    {ingredients.length === 0 ? (
                      <Text style={styles.emptyText}>Add ingredients to assign them to steps.</Text>
                    ) : (
                      ingredients.map((ingredient) => {
                        const usage = step.ingredientUsages.find(
                          (item) => item.ingredientId === ingredient.id,
                        );
                        const isSelected = Boolean(usage);
                        return (
                          <View key={ingredient.id} style={styles.usageRow}>
                            <TouchableOpacity
                              style={[
                                styles.checkbox,
                                isSelected && styles.checkboxSelected,
                              ]}
                              onPress={() => toggleStepIngredientUsage(step.id, ingredient.id)}
                            >
                              {isSelected ? <Text style={styles.checkboxLabel}>✔</Text> : null}
                            </TouchableOpacity>
                            <Text style={styles.usageLabel}>{ingredient.label || "Ingredient"}</Text>
                            {isSelected ? (
                              <TextInput
                                style={[styles.input, styles.usageInput]}
                                placeholder="Amount used"
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={usage?.amount ?? ""}
                                onChangeText={(text) =>
                                  updateStepIngredientUsage(step.id, ingredient.id, { amount: text })
                                }
                              />
                            ) : null}
                          </View>
                        );
                      })
                    )}
                    {steps.length > 1 ? (
                      <>
                        <Text style={styles.subheading}>Unlocked after</Text>
                        <View style={styles.dependencyList}>
                          {steps
                            .filter((candidate) => candidate.id !== step.id)
                            .map((candidate) => {
                              const isRequired = step.requires.includes(candidate.id);
                              return (
                                <TouchableOpacity
                                  key={candidate.id}
                                  style={[
                                    styles.dependencyChip,
                                    isRequired && styles.dependencyChipActive,
                                  ]}
                                  onPress={() => toggleStepDependency(step.id, candidate.id)}
                                >
                                  <Text
                                    style={[
                                      styles.dependencyText,
                                      isRequired && styles.dependencyTextActive,
                                    ]}
                                  >
                                    {candidate.summary || `Step ${steps.indexOf(candidate) + 1}`}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                        </View>
                      </>
                    ) : null}
                    {databoxes.length ? (
                      <>
                        <Text style={styles.subheading}>Databox references</Text>
                        {databoxes.map((box) => {
                          const assignment = step.databoxValues.find(
                            (entry) => entry.databoxId === box.id,
                          );
                          const isActive = Boolean(assignment);
                          return (
                            <View key={box.id} style={styles.usageRow}>
                              <TouchableOpacity
                                style={[styles.checkbox, isActive && styles.checkboxSelected]}
                                onPress={() => toggleStepDataboxReference(step.id, box.id)}
                              >
                                {isActive ? <Text style={styles.checkboxLabel}>✔</Text> : null}
                              </TouchableOpacity>
                              <Text style={styles.usageLabel}>{box.label}</Text>
                              {isActive ? (
                                <TextInput
                                  style={[styles.input, styles.usageInput]}
                                  placeholder="Value recorded during this step"
                                  placeholderTextColor="rgba(255,255,255,0.4)"
                                  value={assignment?.value ?? ""}
                                  onChangeText={(text) =>
                                    updateStepDataboxValue(step.id, box.id, text)
                                  }
                                />
                              ) : null}
                            </View>
                          );
                        })}
                      </>
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Nutrition (estimated)</Text>
          <Text style={styles.helperText}>
            Select the nutrition fields you want to show. These values are tagged as “estimated”.
          </Text>
          <View style={styles.chipRow}>
            {NUTRITION_OPTIONS.map((option) => {
              const active = nutritionFields.some((field) => field.key === option.key);
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleNutritionField(option)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {nutritionFields.map((field) => (
            <View key={field.id} style={styles.nutritionRow}>
              <Text style={styles.nutritionLabel}>
                {field.label} ({field.unit})
              </Text>
              <View style={styles.estimatedBadge}>
                <Text style={styles.estimatedBadgeText}>estimated</Text>
              </View>
              <TextInput
                style={[styles.input, styles.nutritionInput]}
                placeholder="Value"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="numeric"
                value={field.estimatedValue}
                onChangeText={(text) => updateNutritionValue(field.id, text)}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Databoxes</Text>
            <TouchableOpacity style={styles.addButton} onPress={addDatabox}>
              <Text style={styles.addButtonText}>+ Databox</Text>
            </TouchableOpacity>
          </View>
          {databoxes.length === 0 ? (
            <Text style={styles.emptyText}>Add databoxes to compute custom values.</Text>
          ) : null}
          {databoxes.map((box) => (
            <View key={box.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{box.label || "Databox"}</Text>
                <TouchableOpacity onPress={() => removeDatabox(box.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Label"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={box.label}
                onChangeText={(text) => updateDatabox(box.id, { label: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Default value"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="numeric"
                value={box.defaultValue}
                onChangeText={(text) => updateDatabox(box.id, { defaultValue: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Expression (e.g. servings * 2)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={box.expression}
                onChangeText={(text) => updateDatabox(box.id, { expression: text })}
              />
              <Text style={styles.helperText}>
                Current value:{" "}
                <Text style={styles.helperValue}>
                  {Number.isFinite(databoxPreview[box.id])
                    ? databoxPreview[box.id].toFixed(2)
                    : box.defaultValue}
                </Text>
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
          onPress={handleSaveRecipe}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save recipe"}</Text>
        </TouchableOpacity>

        <Modal
          visible={linkModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLinkModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Link pantry item</Text>
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {pantryOptions.length ? (
                  pantryOptions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.modalOption}
                      onPress={() => {
                        if (linkingIngredientId) {
                          updateIngredient(linkingIngredientId, { linkedFoodId: item.id });
                        }
                        setLinkModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    No foods found in this group. Add items to your pantry first.
                  </Text>
                )}
                {linkingIngredientId ? (
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => {
                      updateIngredient(linkingIngredientId, { linkedFoodId: "" });
                      setLinkModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalClearText}>Clear link</Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setLinkModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {savedRecipe ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Structured recipe JSON</Text>
            <View style={styles.jsonCard}>
              <Text style={styles.jsonText}>
                {JSON.stringify({ recipe: savedRecipe, databoxValues: savedDataboxResults }, null, 2)}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050810",
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 20,
  },
  title: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
  },
  section: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0a0f1c",
    padding: 16,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
    backgroundColor: "#050913",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  inputHalf: {
    flex: 1,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#070d18",
    padding: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  cardTitleInput: {
    flex: 1,
  },
  removeText: {
    color: "#ff7a7a",
    fontWeight: "600",
  },
  subheading: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 4,
  },
  usageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  checkboxLabel: {
    color: "#050810",
    fontWeight: "700",
  },
  usageLabel: {
    flex: 1,
    color: "#ffffff",
  },
  usageInput: {
    flex: 1,
  },
  dependencyList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dependencyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  dependencyChipActive: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  dependencyText: {
    color: "rgba(255,255,255,0.7)",
  },
  dependencyTextActive: {
    color: "#050810",
    fontWeight: "600",
  },
  helperText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  helperValue: {
    color: "#0fb06a",
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chipActive: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  chipText: {
    color: "rgba(255,255,255,0.7)",
  },
  chipTextActive: {
    color: "#050810",
    fontWeight: "600",
  },
  nutritionRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
    gap: 6,
    backgroundColor: "#060c17",
  },
  nutritionLabel: {
    color: "#ffffff",
    fontWeight: "600",
  },
  estimatedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  estimatedBadgeText: {
    fontSize: 11,
    letterSpacing: 1,
    color: "rgba(255,255,255,0.7)",
  },
  nutritionInput: {
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 20,
    backgroundColor: "#0fb06a",
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#050810",
    fontWeight: "700",
    fontSize: 16,
  },
  jsonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#03060d",
    padding: 12,
  },
  jsonText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Courier",
    fontSize: 12,
  },
  groupSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#080f1a",
    marginTop: 6,
  },
  groupSelectorText: {
    color: "#ffffff",
    fontSize: 16,
  },
  groupSelectorCaret: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  groupDropdown: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0a111f",
  },
  groupDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  groupDropdownItemActive: {
    backgroundColor: "rgba(15,176,106,0.12)",
  },
  groupDropdownLabel: {
    color: "#ffffff",
    fontSize: 16,
  },
  groupDropdownLabelActive: {
    color: "#0fb06a",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  linkIcon: {
    marginLeft: 2,
  },
  linkInput: {
    flex: 1,
  },
  linkLabel: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  linkLabelActive: {
    color: "#ffffff",
  },
  stepTitleInput: {},
  stepDescriptionInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  stepMetaRow: {
    marginTop: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepMetaText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "86%",
    maxHeight: "70%",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#050810",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  modalList: {
    marginTop: 4,
    marginBottom: 8,
  },
  modalOption: {
    paddingVertical: 10,
  },
  modalOptionText: {
    color: "#ffffff",
    fontSize: 15,
  },
  modalClearText: {
    color: "#ff7a7a",
    fontSize: 14,
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalCloseText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
});
