import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useRoute } from "@react-navigation/native";
import type {
  RecipeDatabox,
  RecipeIngredient,
  RecipeNutritionField,
  RecipeStep,
} from "../types/recipes";

type CookRecipePayload = {
  title: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition: RecipeNutritionField[];
  databoxes: RecipeDatabox[];
};

type RecipeCookRouteParams = {
  recipe: CookRecipePayload;
};

type RecipeCookRoute = RouteProp<{ RecipeCook: RecipeCookRouteParams }, "RecipeCook">;

export const RecipeCookScreen = () => {
  const route = useRoute<RecipeCookRoute>();
  const { recipe } = route.params;
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [databoxValues, setDataboxValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    recipe.databoxes.forEach((box) => {
      initial[box.id] = box.defaultValue ?? "";
    });
    return initial;
  });

  const hasDataboxes = useMemo(() => recipe.databoxes && recipe.databoxes.length > 0, [recipe.databoxes]);

  const steps = recipe.steps ?? [];
  const ingredients = recipe.ingredients ?? [];

  const usedIngredientIds = useMemo(() => {
    const used = new Set<string>();
    steps.forEach((step) => {
      if (!completedSteps[step.id]) return;
      step.ingredientUsages.forEach((usage) => {
        used.add(usage.ingredientId);
      });
    });
    return used;
  }, [completedSteps, steps]);

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleMissingRecipe = () => {
    Alert.alert("Recipe missing", "This recipe does not have structured instructions attached yet.");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.metaText}>
          Prep: {recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min` : "—"} · Cook:{" "}
          {recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min` : "—"} · Serves:{" "}
          {recipe.servings ?? "—"}
        </Text>

        {ingredients.length === 0 && steps.length === 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>No instructions</Text>
            <Text style={styles.bodyText}>
              This recipe was saved without structured ingredients or steps. Open it in the editor to
              add full instructions.
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleMissingRecipe}>
              <Text style={styles.secondaryButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {ingredients.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Ingredients</Text>
            {ingredients.map((ingredient) => (
              <Text
                key={ingredient.id}
                style={[
                  styles.bodyText,
                  usedIngredientIds.has(ingredient.id) && styles.ingredientUsedText,
                ]}
              >
                • {ingredient.label || "Ingredient"}
                {ingredient.amount ? ` · ${ingredient.amount} ${ingredient.unit || ""}` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        {steps.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Steps</Text>
            {steps.map((step, index) => {
              const done = completedSteps[step.id];
              const requires = step.requires ?? [];
              const unlocked = !requires.length || requires.every((id) => completedSteps[id]);
              return (
                <TouchableOpacity
                  key={step.id}
                  style={[styles.stepRow, !unlocked && !done && styles.stepRowDisabled]}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!unlocked && !done) {
                      Alert.alert("Finish earlier step", "Complete the required step before this one.");
                      return;
                    }
                    toggleStep(step.id);
                  }}
                >
                  <View style={[styles.checkbox, done && styles.checkboxDone]}>
                    {done ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <View style={styles.stepTextContainer}>
                    <Text
                      style={[
                        styles.stepTitle,
                        done && styles.stepTitleDone,
                        !unlocked && !done && styles.stepTitleLocked,
                      ]}
                    >
                      {index + 1}. {step.summary || "Step"}
                    </Text>
                    {step.notes ? (
                      <Text
                        style={[
                          styles.stepBody,
                          !unlocked && !done && styles.stepBodyLocked,
                        ]}
                      >
                        {step.notes}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {hasDataboxes ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Databoxes</Text>
            <Text style={styles.sectionSubheading}>
              These are recipe-specific variables. You can fill them in while you cook.
            </Text>
            {recipe.databoxes.map((box) => (
              <View key={box.id} style={styles.databoxRow}>
                <Text style={styles.databoxLabel}>{box.label}</Text>
                <TextInput
                  style={styles.databoxInput}
                  placeholder="Value"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={databoxValues[box.id] ?? ""}
                  onChangeText={(text) =>
                    setDataboxValues((prev) => ({
                      ...prev,
                      [box.id]: text,
                    }))
                  }
                />
                {box.expression ? (
                  <Text style={styles.databoxFormula} numberOfLines={1}>
                    = {box.expression}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 6,
  },
  sectionSubheading: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 4,
  },
  ingredientUsedText: {
    textDecorationLine: "line-through",
    color: "rgba(255,255,255,0.5)",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  stepRowDisabled: {
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkboxDone: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  checkboxMark: {
    color: "#050505",
    fontSize: 14,
    fontWeight: "700",
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    color: "#ffffff",
    marginBottom: 2,
  },
  stepTitleDone: {
    textDecorationLine: "line-through",
    color: "rgba(255,255,255,0.6)",
  },
  stepTitleLocked: {
    color: "rgba(255,255,255,0.5)",
  },
  stepBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  stepBodyLocked: {
    color: "rgba(255,255,255,0.6)",
  },
  databoxRow: {
    marginBottom: 10,
  },
  databoxLabel: {
    fontSize: 14,
    color: "#ffffff",
    marginBottom: 4,
  },
  databoxInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#ffffff",
    fontSize: 14,
    marginBottom: 2,
  },
  databoxFormula: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  secondaryButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignSelf: "flex-start",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
  },
});
