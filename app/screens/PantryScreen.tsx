import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabaseClient";
import { FoodEntryModal } from "../components/FoodEntryModal";
import type { EditableFood, ServingFromDB } from "../types/food";

const PANTRY_TAB_OPTIONS = ["Foods", "Recipes"] as const;
type PantryTab = (typeof PANTRY_TAB_OPTIONS)[number];

const DEFAULT_GROUP_NAMES: string[] = [];
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80";

const NUTRIENT_DISPLAY = [
  { key: "energy_kcal", label: "Energy", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "sat_fat_g", label: "Sat fat", unit: "g" },
  { key: "trans_fat_g", label: "Trans fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
] as const;
type NutrientKey = (typeof NUTRIENT_DISPLAY)[number]["key"];

type Food = {
  id: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  image_url: string | null;
  group_name: string | null;
  group_id?: string | null;
  best_by?: string | null;
  location?: string | null;
  barcode?: string | null;
  cost?: number | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatMoney = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(2)}`;
};

type Recipe = {
  id: string;
  name: string;
  summary: string | null;
  image_url: string | null;
  prep_time: string | null;
  servings: string | null;
  instructions?: string | null;
};

export const PantryScreen = () => {
  const [activeTab, setActiveTab] = useState<PantryTab>("Foods");
  const [groupOptions, setGroupOptions] = useState<string[]>(Array.from(DEFAULT_GROUP_NAMES));
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [isFetchingFoods, setIsFetchingFoods] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [activeFood, setActiveFood] = useState<Food | null>(null);
  const [activeLayout, setActiveLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const detailAnim = useRef(new Animated.Value(0)).current;
  const detailContentFade = useRef(new Animated.Value(0)).current;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isFetchingRecipes, setIsFetchingRecipes] = useState(false);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [activeRecipeLayout, setActiveRecipeLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const recipeAnim = useRef(new Animated.Value(0)).current;
  const recipeContentFade = useRef(new Animated.Value(0)).current;

  const containerRef = useRef<SafeAreaView>(null);
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodServings, setFoodServings] = useState<ServingFromDB[]>([]);
  const [servingsLoading, setServingsLoading] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [foodToEdit, setFoodToEdit] = useState<EditableFood | null>(null);
  const [servingsForEdit, setServingsForEdit] = useState<ServingFromDB[]>([]);
  const detailSnapshotRef = useRef<{
    food: Food;
    layout: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const restoreDetailAfterModalRef = useRef(false);

  const loadFoods = async () => {
    if (!selectedGroup) {
      setFoods([]);
      setIsFetchingFoods(false);
      return [];
    }
    setIsFetchingFoods(true);
    try {
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .eq("group_name", selectedGroup)
        .order("inserted_at", { ascending: false });

      if (error) throw error;
      const result = data ?? [];
      setFoods(result);
      return result;
    } catch (error) {
      console.error(error);
      return [];
    } finally {
      setIsFetchingFoods(false);
    }
  };

  useEffect(() => {
    loadFoods();
  }, [selectedGroup]);

  useEffect(() => {
    const loadRecipes = async () => {
      setIsFetchingRecipes(true);
      try {
        const { data, error } = await supabase
          .from("recipes")
          .select("*")
          .order("inserted_at", { ascending: false });
        if (error) throw error;
        setRecipes(data ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetchingRecipes(false);
      }
    };
    loadRecipes();
  }, []);

  const openCreateModal = () => {
    if (!selectedGroup) {
      Alert.alert("Select a group", "Create or choose a group before adding foods.");
      return;
    }
    setFormMode("create");
    setFoodToEdit(null);
    setServingsForEdit([]);
    setShowFoodModal(true);
  };

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const { data, error } = await supabase
          .from("groups")
          .select("name")
          .order("created_at", { ascending: true });
        if (error) throw error;
        const names = (data ?? []).map((g) => g.name as string);
        setGroupOptions(names);
        if (names.length && !names.includes(selectedGroup)) {
          setSelectedGroup(names[0]);
        }
        if (!names.length) {
          setSelectedGroup("");
        }
      } catch (error) {
        console.error(error);
        setGroupOptions([]);
        setSelectedGroup("");
      }
    };
    loadGroups();
  }, []);

  const handleDeleteFood = (food: Food) => {
    Alert.alert(
      "Delete food",
      `Remove ${food.name} from this pantry?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from("foods").delete().eq("id", food.id);
              if (error) throw error;
              await loadFoods();
            } catch (error) {
              console.error(error);
              Alert.alert("Unable to delete", "Check your connection and try again.");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const loadFoodServings = async (foodId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setServingsLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("food_servings")
        .select("*")
        .eq("food_id", foodId)
        .order("label", { ascending: true });
      if (error) throw error;
      setFoodServings(data ?? []);
      return data ?? [];
    } catch (error) {
      console.error(error);
      setFoodServings([]);
      return [];
    } finally {
      if (!options?.silent) {
        setServingsLoading(false);
      }
    }
  };

  const handleEditFood = async () => {
    if (!activeFood) return;
    let servingsSnapshot = foodServings;
    if (!servingsSnapshot.length) {
      servingsSnapshot = await loadFoodServings(activeFood.id, { silent: true });
    }
    const clonedServings = servingsSnapshot.map((serving) => ({ ...serving }));
    setFoodToEdit(activeFood);
    setServingsForEdit(clonedServings);
    setFormMode("edit");
    restoreDetailAfterModalRef.current = true;
    setShowFoodModal(true);
    closeDetail();
  };

  const restoreDetailIfNeeded = (updatedFoods?: Food[]) => {
    if (!restoreDetailAfterModalRef.current) return;
    restoreDetailAfterModalRef.current = false;
    if (!detailSnapshotRef.current) return;
    const list = updatedFoods ?? foods;
    const snapshot = detailSnapshotRef.current;
    const nextFood =
      list.find((f) => f.id === snapshot.food.id) ?? snapshot.food;
    if (!nextFood) return;
    const layout = snapshot.layout;
    requestAnimationFrame(() => handleSelectFood(nextFood, layout));
  };

  const dismissFoodModal = (shouldRestore: boolean, updatedFoods?: Food[]) => {
    setShowFoodModal(false);
    setFoodToEdit(null);
    setServingsForEdit([]);
    setFormMode("create");
    if (shouldRestore) {
      restoreDetailIfNeeded(updatedFoods);
    } else {
      restoreDetailAfterModalRef.current = false;
    }
  };

  const handleModalClose = () => {
    const shouldRestore = restoreDetailAfterModalRef.current;
    dismissFoodModal(shouldRestore);
  };

  const handleModalSaved = async () => {
    const updated = await loadFoods();
    dismissFoodModal(true, updated);
  };

  const handleSelectRecipe = (
    recipe: Recipe,
    layout: { x: number; y: number; width: number; height: number },
  ) => {
    const relativeLayout = {
      x: layout.x - containerOffset.x,
      y: layout.y - containerOffset.y,
      width: layout.width,
      height: layout.height,
    };
    setActiveRecipe(recipe);
    setActiveRecipeLayout(relativeLayout);
    recipeAnim.setValue(0);
    recipeContentFade.setValue(0);
    Animated.timing(recipeAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(recipeContentFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeRecipeDetail = () => {
    Animated.timing(recipeContentFade, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(recipeAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: false,
      }).start(() => {
        setActiveRecipe(null);
        setActiveRecipeLayout(null);
      });
    });
  };

  const handleSelectFood = (food: Food, layout: { x: number; y: number; width: number; height: number }) => {
    const relativeLayout = {
      x: layout.x - containerOffset.x,
      y: layout.y - containerOffset.y,
      width: layout.width,
      height: layout.height,
    };
    detailSnapshotRef.current = { food, layout: relativeLayout };
    setActiveFood(food);
    setActiveLayout(relativeLayout);
    detailAnim.setValue(0);
    detailContentFade.setValue(0);
    Animated.timing(detailAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(detailContentFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    loadFoodServings(food.id);
  };

  const closeDetail = () => {
    Animated.timing(detailContentFade, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(detailAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: false,
      }).start(() => {
        setActiveFood(null);
        setActiveLayout(null);
        setFoodServings([]);
      });
    });
  };

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const finalWidth = screenWidth - 32;
  const finalHeight = Math.min(screenHeight - 24, screenHeight * 0.92);
  const finalX = (screenWidth - finalWidth) / 2;
  const finalY = Math.max(16, (screenHeight - finalHeight) / 2);
  const heroCollapsedHeight = 110;
  const heroExpandedHeight = Math.min(300, screenHeight * 0.32);
  const detailTitleAnimatedStyle = {
    fontSize: detailAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [15, 28],
    }),
    lineHeight: detailAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 34],
    }),
    marginTop: detailAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [8, 0],
    }),
  };
  const detailSubtitleAnimatedStyle = {
    fontSize: detailAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [13, 14],
    }),
    color: detailAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.75)"],
    }),
    opacity: detailAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 1],
    }),
    transform: [
      {
        translateY: detailAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [2, 0],
        }),
      },
    ],
  };
  const detailBestByPreviewStyle = {
    opacity: detailAnim.interpolate({
      inputRange: [0, 0.75, 1],
      outputRange: [1, 0.35, 0],
    }),
    transform: [
      {
        translateY: detailAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
  };
  const animatedCardStyle =
    activeLayout && activeFood
      ? {
          left: detailAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeLayout.x, finalX],
          }),
          top: detailAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeLayout.y, finalY],
          }),
          width: detailAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeLayout.width, finalWidth],
          }),
          height: detailAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeLayout.height, finalHeight],
          }),
          borderRadius: detailAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 32],
          }),
        }
      : {};

  const recipeAnimatedCardStyle =
    activeRecipeLayout && activeRecipe
      ? {
          left: recipeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeRecipeLayout.x, finalX],
          }),
          top: recipeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeRecipeLayout.y, finalY],
          }),
          width: recipeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeRecipeLayout.width, finalWidth],
          }),
          height: recipeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [activeRecipeLayout.height, finalHeight],
          }),
          borderRadius: recipeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 32],
          }),
        }
      : {};

  return (
    <SafeAreaView
      style={styles.safeArea}
      ref={containerRef}
      onLayout={() => {
        containerRef.current?.measureInWindow((x, y) => {
          setContainerOffset({ x, y });
        });
      }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Text style={styles.sectionLabel}>Pantry</Text>
          <Text style={styles.heroTitle}>Personal &amp; group pantries in one feed</Text>
          <Text style={styles.heroDescription}>
            Everything lives inside exactly one pantry—your own shelf or a shared crew. Owner tags make it
            obvious where “Banana (Personal)” or “Peanut Butter (Three Amigos)” belong.
          </Text>
        </View>

        <View style={styles.inventoryCard}>
          <View style={styles.inventoryHeader}>
          <Text style={styles.inventoryHeading}>Inventory view</Text>
            {groupOptions.length ? (
              <Pressable
                style={styles.groupSelector}
                onPress={() => setShowGroupMenu((prev) => !prev)}
              >
                <Text style={styles.groupSelectorText}>
                  {selectedGroup || groupOptions[0]} pantry
                </Text>
                <Text style={styles.groupSelectorCaret}>{showGroupMenu ? "▲" : "▼"}</Text>
              </Pressable>
            ) : null}
          </View>
          {showGroupMenu && groupOptions.length ? (
            <View style={styles.groupDropdown}>
              {groupOptions.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[
                    styles.groupDropdownItem,
                    selectedGroup === group && styles.groupDropdownItemActive,
                  ]}
                  onPress={() => {
                    setSelectedGroup(group);
                    setShowGroupMenu(false);
                  }}
                >
                  <Text
                    style={[
                      styles.groupDropdownLabel,
                      selectedGroup === group && styles.groupDropdownLabelActive,
                    ]}
                  >
                    {group}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View style={styles.tabRow}>
            {PANTRY_TAB_OPTIONS.map((tab, index) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    index > 0 && styles.tabButtonSpacing,
                    isActive && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.92}
                >
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {activeTab === "Foods" ? (
          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
              <Text style={styles.gridTitle}>Foods</Text>
              <Text style={styles.gridSubtitle}>{foods.length} items</Text>
            </View>
            {isFetchingFoods ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color="#0fb06a" />
                <Text style={styles.loadingText}>Loading pantry...</Text>
              </View>
            ) : foods.length ? (
              <FlatList
                data={foods}
                numColumns={2}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                columnWrapperStyle={{ gap: 12 }}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <FoodCard food={item} onPress={handleSelectFood} onDelete={handleDeleteFood} />
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyBody}>
                  Add an item below to start building the {selectedGroup} pantry.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
              <Text style={styles.gridTitle}>Recipes</Text>
              <Text style={styles.gridSubtitle}>{recipes.length} saved</Text>
            </View>
            {isFetchingRecipes ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color="#0fb06a" />
                <Text style={styles.loadingText}>Loading recipes...</Text>
              </View>
            ) : recipes.length ? (
              <FlatList
                data={recipes}
                numColumns={2}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                columnWrapperStyle={{ gap: 12 }}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <RecipeCard recipe={item} onPress={handleSelectRecipe} />
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No recipes yet</Text>
                <Text style={styles.emptyBody}>
                  Add recipes via Supabase Studio or hook up a quick add here.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.quickAddCard}>
          <Text style={styles.quickAddTitle}>Manual food entry</Text>
          <Text style={styles.quickAddSubtitle}>
            Open a structured sheet to define servings and nutrients, then save to Supabase.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openCreateModal} disabled={!selectedGroup}>
            <Text style={styles.primaryButtonText}>Add food</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            New entries will appear above in the {selectedGroup || "selected"} pantry once saved.
          </Text>
        </View>
      </ScrollView>
      {activeFood && activeLayout ? (
        <>
          <Animated.View
            pointerEvents="auto"
            style={[
              StyleSheet.absoluteFillObject,
              styles.backdrop,
              {
                opacity: detailAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.65],
                }),
              },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={closeDetail} />
          </Animated.View>
          <Animated.View style={[styles.detailOverlay, animatedCardStyle]}>
            <ScrollView
              contentContainerStyle={[styles.detailSheet, { minHeight: finalHeight }]}
              showsVerticalScrollIndicator={true}
              bounces={false}
              contentInset={{ bottom: 48 }}
            >
              <View style={styles.detailHeroWrapper}>
                <Animated.Image
                  source={{ uri: activeFood.image_url || FALLBACK_IMAGE }}
                  style={[
                    styles.detailImage,
                    {
                      height: detailAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [heroCollapsedHeight, heroExpandedHeight],
                      }),
                    },
                  ]}
                  resizeMode="cover"
                />
                <TouchableOpacity onPress={closeDetail} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Animated.View
                style={[
                  styles.detailHeaderBlock,
                  {
                    paddingHorizontal: detailAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 24],
                    }),
                    paddingTop: detailAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 24],
                    }),
                  },
                ]}
              >
                <Animated.Text style={[styles.detailTitle, detailTitleAnimatedStyle]}>
                  {activeFood.name}
                </Animated.Text>
                <Animated.Text style={[styles.detailSubtitle, detailSubtitleAnimatedStyle]}>
                  {(activeFood.location ?? "Unassigned location") +
                    (activeFood.group_name ? ` · ${activeFood.group_name}` : "")}
                </Animated.Text>
                <Animated.Text style={[styles.detailMiniStat, detailBestByPreviewStyle]}>
                  {activeFood.best_by ? `Best by ${formatDate(activeFood.best_by)}` : "No best by date"}
                </Animated.Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.detailMetaRow,
                  {
                    opacity: detailContentFade,
                  },
                ]}
              >
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Best by</Text>
                  <Text style={styles.metaValue}>{formatDate(activeFood.best_by)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Cost</Text>
                  <Text style={styles.metaValue}>{formatMoney(activeFood.cost)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Barcode</Text>
                  <Text style={styles.metaValue}>{activeFood.barcode || "—"}</Text>
                </View>
              </Animated.View>

              <Animated.View
                style={{
                  opacity: detailContentFade,
                  transform: [
                    {
                      translateY: detailContentFade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [15, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Stored details</Text>
                  <Text style={styles.sectionBody}>Quantity: {activeFood.quantity ?? "—"}</Text>
                  <Text style={styles.sectionBody}>
                    Notes: {activeFood.notes?.trim() || "No notes yet"}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Actions</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleEditFood}
                      disabled={servingsLoading}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() =>
                        Alert.alert("Coming soon", "Move to another pantry is not implemented yet.")
                      }
                    >
                      <Text style={styles.actionButtonText}>Move to…</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() =>
                        Alert.alert("Coming soon", "Planning actions will be wired later.")
                      }
                    >
                      <Text style={styles.actionButtonText}>Add to plan</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Servings & nutrition</Text>
                  {servingsLoading ? (
                    <View style={styles.loadingState}>
                      <ActivityIndicator color="#0fb06a" />
                      <Text style={styles.loadingText}>Loading servings...</Text>
                    </View>
                  ) : foodServings.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View>
                        <View style={styles.detailGridHeaderRow}>
                          <View style={styles.detailGridLabelCell}>
                            <Text style={styles.sectionTitle}>Nutrient</Text>
                          </View>
                          {foodServings.map((serving) => (
                            <View key={serving.id} style={styles.detailGridServingCell}>
                              <Text style={styles.detailGridServingTitle}>
                                {serving.label || "Serving"}
                              </Text>
                              <Text style={styles.detailGridServingMeta}>
                                {serving.amount ?? ""} {serving.unit ?? ""}
                              </Text>
                            </View>
                          ))}
                        </View>
                        {NUTRIENT_DISPLAY.map((row) => (
                          <View key={row.key} style={styles.detailGridRow}>
                            <View style={styles.detailGridLabelCell}>
                              <Text style={styles.gridLabelText}>{row.label}</Text>
                              <Text style={styles.gridUnitText}>{row.unit}</Text>
                            </View>
                            {foodServings.map((serving) => (
                              <View key={`${serving.id}-${row.key}`} style={styles.detailGridCell}>
                                <Text style={styles.detailGridCellText}>
                                  {serving[row.key] ?? "—"}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  ) : (
                    <Text style={styles.sectionBody}>No servings recorded yet.</Text>
                  )}
                </View>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </>
      ) : null}
      <FoodEntryModal
        visible={showFoodModal}
        mode={formMode}
        foodToEdit={foodToEdit}
        servingsToEdit={servingsForEdit}
        onClose={handleModalClose}
        onSaved={handleModalSaved}
        defaultGroupName={
          formMode === "edit"
            ? foodToEdit?.group_name ?? null
            : selectedGroup || (groupOptions[0] ?? null)
        }
        defaultGroupId={formMode === "edit" ? foodToEdit?.group_id ?? null : null}
      />

      {activeRecipe && activeRecipeLayout ? (
        <>
          <Animated.View
            pointerEvents="auto"
            style={[
              StyleSheet.absoluteFillObject,
              styles.backdrop,
              {
                opacity: recipeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.65],
                }),
              },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={closeRecipeDetail} />
          </Animated.View>
          <Animated.View style={[styles.detailOverlay, recipeAnimatedCardStyle]}>
            <Animated.Image
              source={{ uri: activeRecipe.image_url }}
              style={[
                styles.detailImage,
                {
                  height: recipeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [heroCollapsedHeight, heroExpandedHeight],
                  }),
                },
              ]}
              resizeMode="cover"
            />
            <Animated.View
              style={[
                styles.detailBaseContent,
                {
                  paddingHorizontal: recipeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 24],
                  }),
                  paddingTop: recipeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 18],
                  }),
                },
              ]}
            >
              <Animated.Text
                style={{
                  fontSize: recipeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 28],
                  }),
                  fontWeight: "700",
                  color: "#ffffff",
                  marginBottom: 4,
                }}
                numberOfLines={1}
              >
                {activeRecipe.name}
              </Animated.Text>
              <Animated.Text
                style={{
                  fontSize: recipeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [13, 14],
                  }),
                  color: "rgba(255,255,255,0.6)",
                  opacity: recipeAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 0.4, 1],
                  }),
                }}
                numberOfLines={2}
              >
                {activeRecipe.summary ?? "No summary yet"}
              </Animated.Text>
            </Animated.View>

            <Animated.View
              pointerEvents="auto"
              style={[
                styles.detailScrollWrapper,
                {
                  opacity: recipeContentFade,
                  transform: [
                    {
                      translateY: recipeContentFade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [15, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.detailCloseRow}>
                <TouchableOpacity onPress={closeRecipeDetail} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.detailScroll}>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Prep details</Text>
                  <Text style={styles.sectionBody}>
                    Prep time: {activeRecipe.prep_time ?? "—"}
                  </Text>
                  <Text style={styles.sectionBody}>Makes: {activeRecipe.servings ?? "—"}</Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Ingredients preview</Text>
                  <Text style={styles.sectionBody}>
                    - Citrus glaze, garlic, chili flakes {"\n"}- Roasted seasonal veggies {"\n"}- Fresh
                    herbs for garnish
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  {["Cook now", "Schedule", "Share"].map((action) => (
                    <TouchableOpacity key={action} style={styles.actionButton}>
                      <Text style={styles.actionButtonText}>{action}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </>
      ) : null}
    </SafeAreaView>
  );
};

type FoodCardProps = {
  food: Food;
  onPress: (food: Food, layout: { x: number; y: number; width: number; height: number }) => void;
  onDelete: (food: Food) => void;
};

const FoodCard = ({ food, onPress, onDelete }: FoodCardProps) => {
  const cardRef = useRef<View>(null);
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      setIsPressed(false);
      onPress(food, { x, y, width, height });
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={handlePress}
      style={[styles.foodCard, isPressed && styles.foodCardPressed]}
      ref={cardRef}
    >
      <View>
        <Image source={{ uri: food.image_url || FALLBACK_IMAGE }} style={styles.foodImage} />
        <TouchableOpacity
          style={styles.foodDelete}
          onPress={(event) => {
            event.stopPropagation();
            onDelete(food);
          }}
        >
          <Text style={styles.foodDeleteText}>×</Text>
        </TouchableOpacity>
        <Text style={styles.foodName} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.foodMeta}>
          {(food.location ?? "Unassigned location") +
            (food.group_name ? ` · ${food.group_name}` : "")}
        </Text>
        <Text style={styles.foodMiniStat}>
          {food.best_by ? `Best by ${formatDate(food.best_by)}` : "No best by date"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

type RecipeCardProps = {
  recipe: Recipe;
  onPress: (recipe: Recipe, layout: { x: number; y: number; width: number; height: number }) => void;
};

const RecipeCard = ({ recipe, onPress }: RecipeCardProps) => {
  const cardRef = useRef<View>(null);

  const handlePress = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      onPress(recipe, { x, y, width, height });
    });
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.recipeCard} ref={cardRef}>
      <View>
        <Image source={{ uri: recipe.image_url || FALLBACK_IMAGE }} style={styles.foodImage} />
        <Text style={styles.foodName} numberOfLines={1}>
          {recipe.name}
        </Text>
        <Text style={styles.foodMeta}>{recipe.prep_time ?? "Timing TBD"}</Text>
        <Text style={styles.foodMiniStat}>{recipe.servings ?? "Servings TBD"}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#060a13",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 64,
    flexGrow: 1,
    backgroundColor: "#060a13",
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0c1424",
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: "#000",
    shadowOpacity: 0.65,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
  },
  heroDescription: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
    color: "rgba(255,255,255,0.7)",
  },
  inventoryCard: {
    marginTop: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0b1120",
    padding: 16,
  },
  inventoryHeading: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
  },
  inventoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  tabRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  tabButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "#0b152e",
    paddingVertical: 12,
  },
  tabButtonSpacing: {
    marginLeft: 8,
  },
  tabButtonActive: {
    backgroundColor: "#1b2337",
    borderColor: "rgba(255,255,255,0.4)",
  },
  tabLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  tabLabelActive: {
    color: "#ffffff",
  },
  gridCard: {
    marginTop: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#0d1523",
    padding: 20,
  },
  gridHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  gridTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
  gridSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  loadingState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
  },
  foodCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#10182b",
  },
  foodImage: {
    width: "100%",
    height: 110,
  },
  foodDelete: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  foodDeleteText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  foodName: {
    marginTop: 8,
    marginHorizontal: 10,
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  foodMeta: {
    marginHorizontal: 10,
    marginBottom: 10,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  emptyBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  quickAddCard: {
    marginTop: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(15,176,106,0.4)",
    backgroundColor: "#0b161f",
    padding: 20,
    gap: 12,
  },
  quickAddTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  quickAddSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: "#0fb06a",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#050505",
    fontSize: 16,
    fontWeight: "700",
  },
  helperText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 16,
  },
  groupSelector: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupSelectorText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  groupSelectorCaret: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  groupDropdown: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#050a13",
  },
  groupDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  groupDropdownItemActive: {
    backgroundColor: "rgba(15,176,106,0.12)",
  },
  groupDropdownLabel: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  groupDropdownLabelActive: {
    color: "#0fb06a",
  },
  foodCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  foodMiniStat: {
    marginHorizontal: 10,
    marginBottom: 10,
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },
  recipeCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#111630",
  },
  backdrop: {
    backgroundColor: "#000",
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 20,
  },
  detailOverlay: {
    position: "absolute",
    backgroundColor: "#080c14",
    overflow: "hidden",
    zIndex: 100,
    elevation: 40,
    borderRadius: 28,
  },
  closeButton: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 18,
    padding: 8,
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 5,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  detailSheet: {
    paddingBottom: 80,
    backgroundColor: "#080c14",
    flexGrow: 1,
  },
  detailHeroWrapper: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  detailImage: {
    width: "100%",
    height: 220,
  },
  detailHeaderBlock: {
    paddingBottom: 8,
    backgroundColor: "#080c14",
    gap: 6,
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
  },
  detailSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  detailMiniStat: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  detailMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 8,
  },
  metaItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metaLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.5)",
  },
  metaValue: {
    marginTop: 4,
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
  detailScroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  detailSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#ffffff",
  },
  sectionBody: {
    fontSize: 14,
    color: "#ffffff",
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statPill: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    marginHorizontal: 4,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  detailGridHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  detailGridLabelCell: {
    width: 120,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.12)",
  },
  detailGridServingCell: {
    width: 100,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  detailGridServingTitle: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  detailGridServingMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
  },
  detailGridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  detailGridCell: {
    width: 100,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
  },
  detailGridCellText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  gridLabelText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    fontSize: 13,
  },
  gridUnitText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    marginTop: 2,
  },
});
