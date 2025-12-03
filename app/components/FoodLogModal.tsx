import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { DEFAULT_FOOD_IMAGE } from "../constants/images";
import { supabase } from "../lib/supabaseClient";
import type { EditableFood, ServingFromDB } from "../types/food";

const formatDateKey = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const year = normalized.getFullYear();
  const month = `${normalized.getMonth() + 1}`.padStart(2, "0");
  const day = `${normalized.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type FoodOption = Pick<EditableFood, "id" | "name" | "group_id" | "group_name" | "image_url">;

type FoodLogModalProps = {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void;
  targetDate?: string;
};

export const FoodLogModal = ({ visible, onClose, onLogged, targetDate }: FoodLogModalProps) => {
  const [foodOptions, setFoodOptions] = useState<FoodOption[]>([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [servingsLoading, setServingsLoading] = useState(false);
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [servingOptions, setServingOptions] = useState<ServingFromDB[]>([]);
  const [selectedServingId, setSelectedServingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const effectiveDate = targetDate ?? formatDateKey(new Date());
  const selectedFood = useMemo(
    () => foodOptions.find((food) => food.id === selectedFoodId) ?? null,
    [foodOptions, selectedFoodId],
  );

  const resetState = useCallback(() => {
    setFoodOptions([]);
    setFoodsLoading(false);
    setServingsLoading(false);
    setSelectedFoodId(null);
    setServingOptions([]);
    setSelectedServingId(null);
    setQuantity("1");
    setNotes("");
    setErrorText(null);
    setSaving(false);
  }, []);

  const loadFoodOptions = useCallback(async () => {
    try {
      setFoodsLoading(true);
      const { data, error } = await supabase
        .from("foods")
        .select("id, name, group_id, group_name, image_url")
        .order("name", { ascending: true });
      if (error) throw error;
      setFoodOptions(data ?? []);
    } catch (error) {
      console.error("Failed to load foods for logging", error);
    } finally {
      setFoodsLoading(false);
    }
  }, []);

  const loadServingsForFood = useCallback(async (foodId: string) => {
    try {
      setServingsLoading(true);
      const { data, error } = await supabase
        .from("food_servings")
        .select("id, label, amount, unit, energy_kcal, protein_g, carbs_g, fat_g, sat_fat_g, trans_fat_g, fiber_g, sugar_g, sodium_mg")
        .eq("food_id", foodId)
        .order("label", { ascending: true });
      if (error) throw error;
      setServingOptions(data ?? []);
      setSelectedServingId(data?.[0]?.id ?? null);
    } catch (error) {
      console.error("Failed to load servings for logging", error);
      setServingOptions([]);
      setSelectedServingId(null);
    } finally {
      setServingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    resetState();
    loadFoodOptions();
  }, [visible, resetState, loadFoodOptions]);

  const handleClose = () => {
    if (saving) return;
    resetState();
    onClose();
  };

  const handleSelectFood = (foodId: string) => {
    setSelectedFoodId(foodId);
    setServingOptions([]);
    setSelectedServingId(null);
    setErrorText(null);
    loadServingsForFood(foodId);
  };

  const handleSave = async () => {
    if (!selectedFoodId) {
      setErrorText("Select a food item first.");
      return;
    }
    if (!quantity.trim()) {
      setErrorText("Enter a serving quantity.");
      return;
    }
    const parsedQuantity = Number(quantity);
    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setErrorText("Quantity must be a positive number.");
      return;
    }

    try {
      setSaving(true);
      setErrorText(null);
      const selectedServing = servingOptions.find((serving) => serving.id === selectedServingId) ?? null;
      const payload = {
        food_id: selectedFoodId,
        serving_id: selectedServingId,
        group_id: selectedFood?.group_id ?? null,
        quantity: parsedQuantity,
        logged_date: effectiveDate,
        notes: notes.trim() ? notes.trim() : null,
        food_name: selectedFood?.name ?? null,
        food_image_url: selectedFood?.image_url ?? null,
        food_group_name: selectedFood?.group_name ?? null,
        serving_label: selectedServing?.label ?? null,
        serving_amount: selectedServing?.amount ?? null,
        serving_unit: selectedServing?.unit ?? null,
        energy_kcal: selectedServing?.energy_kcal ?? null,
        protein_g: selectedServing?.protein_g ?? null,
        carbs_g: selectedServing?.carbs_g ?? null,
        fat_g: selectedServing?.fat_g ?? null,
        sat_fat_g: selectedServing?.sat_fat_g ?? null,
        trans_fat_g: selectedServing?.trans_fat_g ?? null,
        fiber_g: selectedServing?.fiber_g ?? null,
        sugar_g: selectedServing?.sugar_g ?? null,
        sodium_mg: selectedServing?.sodium_mg ?? null,
      };
      const { error } = await supabase.from("food_logs").insert(payload);
      if (error) throw error;
      onLogged();
    } catch (error: any) {
      console.error("Failed to log food", error);
      if (error?.code === "PGRST205") {
        setErrorText("Food logging isn’t ready yet. Run ./fragments-supabase/supabase-start.sh and try again.");
      } else {
        setErrorText("Unable to log this item. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(
    selectedFoodId &&
      quantity.trim().length > 0 &&
      !Number.isNaN(Number(quantity)) &&
      Number(quantity) > 0 &&
      !saving,
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <View style={styles.modalCard}>
          <Text style={styles.title}>Log today’s eating</Text>
          <Text style={styles.helperText}>Items are logged for {effectiveDate}.</Text>

          <Text style={styles.label}>Choose an item</Text>
          {foodsLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : foodOptions.length === 0 ? (
            <Text style={styles.helperText}>Add foods to your pantry to log them here.</Text>
          ) : (
            <ScrollView style={styles.foodList} contentContainerStyle={{ gap: 8 }}>
              {foodOptions.map((food) => {
                const active = food.id === selectedFoodId;
                return (
                  <TouchableOpacity
                    key={food.id}
                    style={[styles.foodOption, active && styles.foodOptionActive]}
                    onPress={() => handleSelectFood(food.id)}
                  >
                    <Image
                      source={{ uri: food.image_url || DEFAULT_FOOD_IMAGE }}
                      style={styles.foodImage}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foodName}>{food.name}</Text>
                      <Text style={styles.foodMeta}>{food.group_name || "Ungrouped"}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <Text style={styles.label}>Serving</Text>
          {selectedFoodId ? (
            servingsLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : servingOptions.length === 0 ? (
              <Text style={styles.helperText}>No servings saved. We’ll log this as “unspecified”.</Text>
            ) : (
              <View style={styles.servingOptions}>
                {servingOptions.map((serving) => {
                  const active = serving.id === selectedServingId;
                  return (
                    <TouchableOpacity
                      key={serving.id}
                      style={[styles.servingPill, active && styles.servingPillActive]}
                      onPress={() => setSelectedServingId(serving.id)}
                    >
                      <Text style={[styles.servingPillText, active && styles.servingPillTextActive]}>
                        {serving.label}
                      </Text>
                      {serving.amount !== null ? (
                        <Text style={[styles.servingPillMeta, active && styles.servingPillTextActive]}>
                          {serving.amount}
                          {serving.unit ? ` ${serving.unit}` : ""}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          ) : (
            <Text style={styles.helperText}>Select a food item first.</Text>
          )}

          <Text style={styles.label}>How many servings?</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor="rgba(255,255,255,0.4)"
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any quick notes"
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
          />

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (!canSave || saving) && styles.primaryButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Logging..." : "Log it"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#050505",
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  helperText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  label: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  foodList: {
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 8,
  },
  foodOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: 12,
  },
  foodOptionActive: {
    backgroundColor: "rgba(15,176,106,0.12)",
  },
  foodImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  foodName: {
    color: "#ffffff",
    fontWeight: "600",
  },
  foodMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  servingOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  servingPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  servingPillActive: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  servingPillText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  servingPillMeta: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },
  servingPillTextActive: {
    color: "#050505",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
    fontSize: 16,
  },
  noteInput: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 4,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#0fb06a",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#050505",
    fontWeight: "700",
  },
});
