import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult, CameraViewProps } from "expo-camera";
import { DEFAULT_FOOD_IMAGE } from "../constants/images";
import { lookupBarcode, type BarcodeLookupResult } from "../features/barcodeLookup";
import { supabase } from "../lib/supabaseClient";
import type {
  EditableFood,
  NutrientKeys,
  NutrientSet,
  ServingFromDB,
  ServingInput,
} from "../types/food";

const NUTRIENT_ROWS: { key: NutrientKeys; label: string; unit: string }[] = [
  { key: "energy_kcal", label: "Energy", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "sat_fat_g", label: "Sat fat", unit: "g" },
  { key: "trans_fat_g", label: "Trans fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

const emptyNutrients = (): NutrientSet => ({
  energy_kcal: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  sat_fat_g: "",
  trans_fat_g: "",
  fiber_g: "",
  sugar_g: "",
  sodium_mg: "",
});

const createServing = (seed?: Partial<ServingInput>): ServingInput => ({
  id: seed?.id ?? `serving-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: seed?.label ?? "Default",
  amount: seed?.amount ?? "1",
  unit: seed?.unit ?? "serving",
  nutrients: seed?.nutrients ?? emptyNutrients(),
});

type FoodEntryModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  mode?: "create" | "edit";
  defaultGroupId?: string | null;
  defaultGroupName?: string | null;
  foodToEdit?: EditableFood | null;
  servingsToEdit?: ServingFromDB[];
};

export const FoodEntryModal = ({
  visible,
  onClose,
  onSaved,
  mode = "create",
  defaultGroupId,
  defaultGroupName,
  foodToEdit,
  servingsToEdit = [],
}: FoodEntryModalProps) => {
  const [name, setName] = useState("");
  const [bestBy, setBestBy] = useState("");
  const [location, setLocation] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cost, setCost] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [servings, setServings] = useState<ServingInput[]>([createServing()]);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const scannerLockRef = useRef(false);
  const cameraModuleRef = useRef<typeof import("expo-camera") | null>(null);
  const [scannerComponent, setScannerComponent] = useState<ComponentType<CameraViewProps> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const canAdd = useMemo(() => name.trim().length > 0 && servings.length > 0, [name, servings.length]);

  const resetState = () => {
    setName("");
    setBestBy("");
    setLocation("");
    setBarcode("");
    setCost("");
    setImageUrl(null);
    setServings([createServing()]);
    setErrorText(null);
    setSaving(false);
    setIsScannerVisible(false);
    setScannerComponent(null);
    scannerLockRef.current = false;
  };

  const handleClose = () => {
    if (!saving) {
      resetState();
      onClose();
    }
  };

  const updateServing = (id: string, patch: Partial<ServingInput>) => {
    setServings((prev) =>
      prev.map((serving) => (serving.id === id ? { ...serving, ...patch } : serving)),
    );
  };

  const updateNutrient = (servingId: string, key: NutrientKeys, value: string) => {
    setServings((prev) =>
      prev.map((serving) =>
        serving.id === servingId
          ? { ...serving, nutrients: { ...serving.nutrients, [key]: value } }
          : serving,
      ),
    );
  };

  const addServing = () => {
    setServings((prev) => [...prev, createServing({ label: `Serving ${prev.length + 1}` })]);
  };

  const removeServing = (id: string) => {
    setServings((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  };

  type OpenFoodFactsProductShape = Extract<
    BarcodeLookupResult,
    { source: "openfoodfacts" }
  >["product"];

  const ensureCameraModule = async () => {
    if (cameraModuleRef.current) {
      return cameraModuleRef.current;
    }
    try {
      const module = await import("expo-camera");
      cameraModuleRef.current = module;
      return module;
    } catch (error) {
      console.warn("Camera module unavailable:", error);
      return null;
    }
  };

  const handleScanPress = async () => {
    try {
      const module = await ensureCameraModule();
      if (!module) {
        Alert.alert(
          "Camera unavailable",
          "This build does not include the Expo Camera module. Enter the barcode manually.",
        );
        return;
      }

      if (!permission?.granted) {
        const status = await requestPermission?.();
        if (!status?.granted) {
          Alert.alert(
            "Camera permission needed",
            "Enable camera access to scan barcodes, or enter the code manually.",
          );
          return;
        }
      }

      setScannerComponent(() => module.CameraView);
      scannerLockRef.current = false;
      setIsScannerVisible(true);
    } catch (error) {
      console.warn(error);
      Alert.alert("Scanner unavailable", "Unable to launch the camera scanner right now.");
    }
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (!data || scannerLockRef.current) {
      return;
    }
    scannerLockRef.current = true;
    setIsScannerVisible(false);
    const trimmed = data.trim();
    if (!trimmed) {
      Alert.alert("Invalid barcode", "We couldn't read that code. Please try again.");
      scannerLockRef.current = false;
      return;
    }
    await hydrateFromBarcode(trimmed);
    scannerLockRef.current = false;
  };

  const hydrateFromBarcode = async (code: string) => {
    try {
      setIsLookupLoading(true);
      const result = await lookupBarcode(code);
      setBarcode(code);
      applyLookupResult(result);
    } catch (error) {
      console.error(error);
      Alert.alert("Lookup failed", "We couldn't fetch any info for that barcode.");
    } finally {
      setIsLookupLoading(false);
    }
  };

  const applyLookupResult = (result: BarcodeLookupResult) => {
    setImageUrl(result.photoUrl || DEFAULT_FOOD_IMAGE);
    if (result.source === "supabase") {
      const { food, servings: dbServings } = result;
      setName(food.name ?? "");
      setBestBy(food.best_by ?? "");
      setLocation(food.location ?? "");
      setCost(food.cost !== null && food.cost !== undefined ? String(food.cost) : "");
      if (dbServings.length) {
        setServings(dbServings.map(mapServingFromDBRow));
      }
      Alert.alert("Found in pantry", "We loaded this item from your saved foods.");
      return;
    }

    if (result.source === "openfoodfacts") {
      const serving = buildServingFromOpenFoodFacts(result.product);
      if (result.product.name) {
        setName(result.product.name);
      }
      if (serving) {
        setServings([serving]);
      }
      Alert.alert("Pulled from OpenFoodFacts", "Review the auto-filled nutrition details.");
      return;
    }

    Alert.alert("No match found", "Enter the details manually and they will be saved for next time.");
  };

  const mapServingFromDBRow = (serving: ServingFromDB): ServingInput =>
    createServing({
      id: serving.id,
      label: serving.label ?? "Serving",
      amount: serving.amount !== null && serving.amount !== undefined ? String(serving.amount) : "",
      unit: serving.unit ?? "",
      nutrients: {
        energy_kcal: serving.energy_kcal !== null ? String(serving.energy_kcal) : "",
        protein_g: serving.protein_g !== null ? String(serving.protein_g) : "",
        carbs_g: serving.carbs_g !== null ? String(serving.carbs_g) : "",
        fat_g: serving.fat_g !== null ? String(serving.fat_g) : "",
        sat_fat_g: serving.sat_fat_g !== null ? String(serving.sat_fat_g) : "",
        trans_fat_g: serving.trans_fat_g !== null ? String(serving.trans_fat_g) : "",
        fiber_g: serving.fiber_g !== null ? String(serving.fiber_g) : "",
        sugar_g: serving.sugar_g !== null ? String(serving.sugar_g) : "",
        sodium_mg: serving.sodium_mg !== null ? String(serving.sodium_mg) : "",
      },
    });

  const buildServingFromOpenFoodFacts = (product: OpenFoodFactsProductShape): ServingInput | null => {
    const { label, amount, unit } = parseServingSize(product.servingSize);
    const nutriments = product.nutriments ?? {};
    const energyKcal =
      pickNutrimentValue(nutriments, ["energy-kcal_serving", "energy-kcal_100g"]) ??
      convertKjToKcal(pickNutrimentValue(nutriments, ["energy-kj_serving", "energy-kj_100g"]));

    const sodiumValue = pickNutrimentValue(nutriments, ["sodium_serving", "sodium_100g"]);
    const saltValue = pickNutrimentValue(nutriments, ["salt_serving", "salt_100g"]);
    const sodiumMg = sodiumValue !== null ? sodiumValue * 1000 : saltValue !== null ? saltValue * 400 : null;

    const nutrients: NutrientSet = {
      energy_kcal: formatNutrientValue(energyKcal),
      protein_g: formatNutrientValue(pickNutrimentValue(nutriments, ["proteins_serving", "proteins_100g"])),
      carbs_g: formatNutrientValue(
        pickNutrimentValue(nutriments, ["carbohydrates_serving", "carbohydrates_100g"]),
      ),
      fat_g: formatNutrientValue(pickNutrimentValue(nutriments, ["fat_serving", "fat_100g"])),
      sat_fat_g: formatNutrientValue(
        pickNutrimentValue(nutriments, ["saturated-fat_serving", "saturated-fat_100g"]),
      ),
      trans_fat_g: formatNutrientValue(
        pickNutrimentValue(nutriments, ["trans-fat_serving", "trans-fat_100g"]),
      ),
      fiber_g: formatNutrientValue(pickNutrimentValue(nutriments, ["fiber_serving", "fiber_100g"])),
      sugar_g: formatNutrientValue(pickNutrimentValue(nutriments, ["sugars_serving", "sugars_100g"])),
      sodium_mg: formatNutrientValue(sodiumMg),
    };

    return createServing({
      label,
      amount,
      unit,
      nutrients,
    });
  };

  const parseServingSize = (value?: string | null) => {
    if (!value) {
      return { label: "Per 100g", amount: "100", unit: "g" };
    }
    const cleaned = value.trim();
    const match = cleaned.match(/^([\d.]+)\s*(.*)$/);
    if (!match) {
      return { label: `Per ${cleaned}`, amount: "1", unit: cleaned || "serving" };
    }
    const [, qty, rest] = match;
    return {
      label: `Per ${cleaned}`,
      amount: qty || "1",
      unit: rest?.trim() || "serving",
    };
  };

  const pickNutrimentValue = (
    nutriments: Record<string, number | string | undefined>,
    keys: string[],
  ): number | null => {
    for (const key of keys) {
      const raw = nutriments[key];
      const value = toNumber(raw);
      if (typeof value === "number" && !Number.isNaN(value)) {
        return value;
      }
    }
    return null;
  };

  const toNumber = (value: number | string | undefined | null): number | null => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const formatNutrientValue = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const rounded = Math.round(value * 100) / 100;
    return Number.isFinite(rounded) ? String(rounded) : "";
  };

  const convertKjToKcal = (value: number | null): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    return value / 4.184;
  };

  useEffect(() => {
    if (!visible) {
      resetState();
      return;
    }

    if (mode === "edit" && foodToEdit) {
      setName(foodToEdit.name ?? "");
      setBestBy(foodToEdit.best_by ?? "");
      setLocation(foodToEdit.location ?? "");
      setBarcode(foodToEdit.barcode ?? "");
      setCost(
        foodToEdit.cost !== null && foodToEdit.cost !== undefined
          ? String(foodToEdit.cost)
          : "",
      );
      setImageUrl(foodToEdit.image_url ?? null);
      if (servingsToEdit.length) {
        setServings(servingsToEdit.map(mapServingFromDBRow));
      } else {
        setServings([createServing()]);
      }
    } else if (mode === "create") {
      resetState();
    }
  }, [visible, mode, foodToEdit, servingsToEdit]);

  const handleSave = async () => {
    if (!canAdd || saving) return;
    setSaving(true);
    setErrorText(null);

    try {
      const costNumber = cost.trim() ? Number(cost) : null;
      if (costNumber !== null && Number.isNaN(costNumber)) {
        throw new Error("Cost must be a number.");
      }

      let targetFoodId = foodToEdit?.id ?? null;
      const payloadBase = {
        name: name.trim(),
        notes: null,
        quantity: null,
        image_url: imageUrl || null,
        group_name: foodToEdit?.group_name ?? defaultGroupName ?? null,
        group_id: foodToEdit?.group_id ?? defaultGroupId ?? null,
        best_by: bestBy || null,
        location: location || null,
        barcode: barcode || null,
        cost: costNumber,
      };

      if (mode === "edit" && foodToEdit) {
        const { error: updateError } = await supabase
          .from("foods")
          .update(payloadBase)
          .eq("id", foodToEdit.id);
        if (updateError) throw updateError;
        targetFoodId = foodToEdit.id;
        await supabase.from("food_servings").delete().eq("food_id", foodToEdit.id);
      } else {
        const { data: food, error: foodError } = await supabase
          .from("foods")
          .insert(payloadBase)
          .select()
          .single();

        if (foodError) throw foodError;
        targetFoodId = food.id;
      }

      if (!targetFoodId) {
        throw new Error("Missing food id after save.");
      }

      const payload = servings.map((serving) => ({
        food_id: targetFoodId,
        label: serving.label.trim() || "Serving",
        amount: serving.amount.trim() ? Number(serving.amount) : null,
        unit: serving.unit.trim() || null,
        energy_kcal: serving.nutrients.energy_kcal.trim()
          ? Number(serving.nutrients.energy_kcal)
          : null,
        protein_g: serving.nutrients.protein_g.trim()
          ? Number(serving.nutrients.protein_g)
          : null,
        carbs_g: serving.nutrients.carbs_g.trim()
          ? Number(serving.nutrients.carbs_g)
          : null,
        fat_g: serving.nutrients.fat_g.trim() ? Number(serving.nutrients.fat_g) : null,
        sat_fat_g: serving.nutrients.sat_fat_g.trim()
          ? Number(serving.nutrients.sat_fat_g)
          : null,
        trans_fat_g: serving.nutrients.trans_fat_g.trim()
          ? Number(serving.nutrients.trans_fat_g)
          : null,
        fiber_g: serving.nutrients.fiber_g.trim() ? Number(serving.nutrients.fiber_g) : null,
        sugar_g: serving.nutrients.sugar_g.trim() ? Number(serving.nutrients.sugar_g) : null,
        sodium_mg: serving.nutrients.sodium_mg.trim()
          ? Number(serving.nutrients.sodium_mg)
          : null,
      }));

      const { error: servingError } = await supabase.from("food_servings").insert(payload);
      if (servingError) throw servingError;

      resetState();
      await onSaved();
    } catch (error: any) {
      console.error(error);
      setErrorText(error.message ?? "Unable to save food. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const Scanner = scannerComponent;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>{mode === "edit" ? "Edit food" : "Add food"}</Text>
            <View style={styles.photoPreviewWrapper}>
              <Image
                source={{ uri: imageUrl || DEFAULT_FOOD_IMAGE }}
                style={styles.photoPreview}
                resizeMode="cover"
              />
              <Text style={styles.photoHint}>
                This photo updates automatically when data is found for your barcode.
              </Text>
            </View>

            {/* Basic info */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Basic Info</Text>
              <TextInput
                style={styles.input}
                placeholder="Name *"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={name}
                onChangeText={setName}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Best by (YYYY-MM-DD)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={bestBy}
                  onChangeText={setBestBy}
                />
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Location (Fridge, Freezer...)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Barcode"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={barcode}
                  onChangeText={setBarcode}
                />
                <TouchableOpacity
                  style={[
                    styles.scanButton,
                    (isLookupLoading || saving) && styles.scanButtonDisabled,
                  ]}
                  onPress={handleScanPress}
                  disabled={isLookupLoading || saving}
                >
                  {isLookupLoading ? (
                    <ActivityIndicator size="small" color="#050505" />
                  ) : (
                    <Text style={styles.scanButtonText}>Scan</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Cost"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={cost}
                onChangeText={setCost}
                keyboardType="numeric"
              />
            </View>

            {/* Servings */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Servings</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.servingRow}
              >
                {servings.map((serving, index) => (
                  <View key={serving.id} style={styles.servingCard}>
                    <TextInput
                      style={styles.servingLabel}
                      placeholder="Label"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={serving.label}
                      onChangeText={(text) => updateServing(serving.id, { label: text })}
                    />
                    <View style={styles.servingAmountRow}>
                      <TextInput
                        style={[styles.servingInput, styles.servingAmount]}
                        placeholder="1"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        keyboardType="numeric"
                        value={serving.amount}
                        onChangeText={(text) => updateServing(serving.id, { amount: text })}
                      />
                      <TextInput
                        style={[styles.servingInput, styles.servingUnit]}
                        placeholder="serving"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={serving.unit}
                        onChangeText={(text) => updateServing(serving.id, { unit: text })}
                      />
                    </View>
                    {servings.length > 1 ? (
                      <TouchableOpacity
                        style={styles.removeServing}
                        onPress={() => removeServing(serving.id)}
                      >
                        <Text style={styles.removeServingText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
                <TouchableOpacity style={styles.addServingButton} onPress={addServing}>
                  <Text style={styles.addServingText}>+ Add serving</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Nutrient grid */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Nutrients per serving</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.gridHeaderRow}>
                    <View style={styles.gridLabelCell}>
                      <Text style={styles.gridHeaderText}>Nutrient</Text>
                    </View>
                    {servings.map((serving) => (
                      <View key={serving.id} style={styles.gridServingHeader}>
                        <Text style={styles.gridServingTitle} numberOfLines={1}>
                          {serving.label || "Serving"}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {NUTRIENT_ROWS.map((row) => (
                    <View key={row.key} style={styles.gridRow}>
                      <View style={styles.gridLabelCell}>
                        <Text style={styles.gridLabelText}>{row.label}</Text>
                        <Text style={styles.gridUnitText}>{row.unit}</Text>
                      </View>
                      {servings.map((serving) => (
                        <View key={`${serving.id}-${row.key}`} style={styles.gridCell}>
                          <TextInput
                            style={styles.gridInput}
                            keyboardType="numeric"
                            value={serving.nutrients[row.key]}
                            onChangeText={(text) => updateNutrient(serving.id, row.key, text)}
                            placeholder="0"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                          />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleClose}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, (!canAdd || saving) && styles.primaryButtonDisabled]}
                onPress={handleSave}
                disabled={!canAdd || saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "Saving..." : mode === "edit" ? "Save" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={isScannerVisible} animationType="fade" presentationStyle="fullScreen">
      <View style={styles.scannerContainer}>
        {Scanner ? (
          <Scanner
            style={styles.cameraPreview}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : (
          <View style={styles.scannerUnavailable}>
            <Text style={styles.scannerText}>Scanner module missing in this build.</Text>
          </View>
        )}
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Align the barcode within the frame</Text>
          <TouchableOpacity
            style={styles.scannerCloseButton}
            onPress={() => {
              setIsScannerVisible(false);
              setScannerComponent(null);
              scannerLockRef.current = false;
            }}
          >
            <Text style={styles.scannerCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    maxHeight: "90%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#050915",
    overflow: "hidden",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#ffffff",
  },
  photoPreviewWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#060e1c",
    padding: 10,
    gap: 6,
  },
  photoPreview: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    backgroundColor: "#04070f",
  },
  photoHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#060e1c",
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
    backgroundColor: "#050a13",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  inputHalf: {
    flex: 1,
  },
  scanButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  servingRow: {
    marginTop: 10,
    alignItems: "stretch",
  },
  servingCard: {
    width: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#050b18",
    padding: 10,
    marginRight: 8,
  },
  servingLabel: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#ffffff",
    backgroundColor: "#050a13",
    fontSize: 13,
  },
  servingAmountRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  servingInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#ffffff",
    backgroundColor: "#050a13",
    fontSize: 13,
  },
  servingAmount: {
    flex: 1,
  },
  servingUnit: {
    flex: 1.2,
  },
  removeServing: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  removeServingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
  },
  addServingButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },
  addServingText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  gridHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.14)",
  },
  gridLabelCell: {
    width: 120,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.14)",
  },
  gridHeaderText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  gridServingHeader: {
    width: 90,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
  },
  gridServingTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  gridLabelText: {
    color: "#ffffff",
    fontSize: 13,
  },
  gridUnitText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 2,
  },
  gridCell: {
    width: 90,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  gridInput: {
    width: "100%",
    paddingVertical: 6,
    paddingHorizontal: 6,
    color: "#ffffff",
    textAlign: "center",
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#0fb06a",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: "#f97373",
    fontSize: 13,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "flex-end",
  },
  scannerOverlay: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  cameraPreview: {
    flex: 1,
    alignSelf: "stretch",
  },
  scannerText: {
    color: "#ffffff",
    fontSize: 16,
    textAlign: "center",
  },
  scannerCloseButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scannerCloseText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  scannerUnavailable: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
});
