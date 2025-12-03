import { useMemo } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DEFAULT_FOOD_IMAGE } from "../constants/images";
import type { FoodLogEntry } from "../types/food";

const NUTRIENT_LABELS: Array<{ key: keyof NonNullable<FoodLogEntry["serving"]>; label: string; unit: string }> = [
  { key: "energy_kcal", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "sat_fat_g", label: "Sat fat", unit: "g" },
  { key: "trans_fat_g", label: "Trans fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

type FoodLogDetailsModalProps = {
  visible: boolean;
  entry: FoodLogEntry | null;
  onClose: () => void;
};

export const FoodLogDetailsModal = ({ visible, entry, onClose }: FoodLogDetailsModalProps) => {
  const nutrientTotals = useMemo(() => {
    if (!entry) return {} as Record<string, number | null>;
    const quantity = Number(entry.quantity ?? 0) || 0;
    return NUTRIENT_LABELS.reduce<Record<string, number | null>>((acc, item) => {
      const fromServing = entry.serving?.[item.key];
      const fallback = entry[item.key];
      const numericBase =
        typeof fromServing === "number"
          ? fromServing
          : typeof fallback === "number"
            ? fallback
            : typeof fallback === "string"
              ? Number(fallback)
              : null;
      acc[item.key] =
        numericBase !== null && Number.isFinite(numericBase) ? numericBase * quantity : null;
      return acc;
    }, {});
  }, [entry]);

  if (!entry) {
    return null;
  }

  const displayName = entry.food?.name ?? entry.food_name ?? "Food item";
  const displayGroup = entry.food?.group_name ?? entry.food_group_name ?? "Ungrouped";
  const imageUrl = entry.food?.image_url ?? entry.food_image_url ?? DEFAULT_FOOD_IMAGE;
  const servingLabel = entry.serving?.label ?? entry.serving_label ?? "Serving";
  const servingAmount = entry.serving?.amount ?? entry.serving_amount ?? null;
  const servingUnit = entry.serving?.unit ?? entry.serving_unit ?? null;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{displayName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{displayGroup}</Text>
          <Image source={{ uri: imageUrl }} style={styles.image} />
          <Text style={styles.detailText}>Quantity: {entry.quantity ?? 1}</Text>
          <Text style={styles.detailText}>
            Serving: {servingLabel}
            {servingAmount !== null ? ` (${servingAmount}${servingUnit ? ` ${servingUnit}` : ""})` : ""}
          </Text>
          {entry.notes ? <Text style={styles.detailText}>Notes: {entry.notes}</Text> : null}
          <ScrollView style={styles.nutrientList} contentContainerStyle={{ gap: 8 }}>
            {NUTRIENT_LABELS.map((nutrient) => (
              <View key={nutrient.key} style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>{nutrient.label}</Text>
                <Text style={styles.nutrientValue}>
                  {nutrientTotals[nutrient.key] !== null && nutrientTotals[nutrient.key] !== undefined
                    ? `${Math.round((nutrientTotals[nutrient.key] ?? 0) * 10) / 10} ${nutrient.unit}`
                    : "N/A"}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#050505",
    borderRadius: 24,
    padding: 20,
    gap: 8,
    maxHeight: "90%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  closeButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    marginVertical: 8,
  },
  detailText: {
    color: "rgba(255,255,255,0.75)",
  },
  nutrientList: {
    marginTop: 12,
  },
  nutrientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 12,
  },
  nutrientLabel: {
    color: "rgba(255,255,255,0.8)",
  },
  nutrientValue: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
