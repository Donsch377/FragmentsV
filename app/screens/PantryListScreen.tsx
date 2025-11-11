import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { QuantityBadge } from "../components/QuantityBadge";
import { EmptyState } from "../components/EmptyState";
import { Toolbar } from "../components/Toolbar";
import { useFragmentsStore } from "../stores/useFragmentsStore";
import { useInventoryStore } from "../stores/useInventoryStore";
import type { PantryStackParamList } from "../navigation/PantryStack";
import type { Unit } from "../models/types";

const FILTERS = ["Foods", "Tools", "Recipes"];
const ACCEPTED_UNITS: Unit[] = ["g", "ml", "pcs"];

export const PantryListScreen = () => {
  const navigation =
    useNavigation<StackNavigationProp<PantryStackParamList>>();
  const [activeFilter, setActiveFilter] = useState("Foods");
  const [quickAdd, setQuickAdd] = useState({
    name: "",
    brand: "",
    quantity: "1",
    unit: "pcs",
    barcode: "",
  });
  const { fragments, load: loadFragments } = useFragmentsStore();
  const {
    items,
    load,
    activePantryFragmentId,
    addOrUpdate,
    searchItems,
    setSort,
    sort,
  } = useInventoryStore();

  useEffect(() => {
    loadFragments("inventory_list");
  }, [loadFragments]);

  useEffect(() => {
    const firstFragmentId = fragments[0]?.id;
    if (!activePantryFragmentId && firstFragmentId) {
      load(firstFragmentId);
    }
  }, [fragments, activePantryFragmentId, load]);

  const activeFragment = useMemo(
    () =>
      fragments.find((fragment) => fragment.id === activePantryFragmentId) ??
      fragments[0],
    [fragments, activePantryFragmentId]
  );

  const onQuickAdd = async () => {
    if (!quickAdd.name || !activeFragment) {
      return;
    }
    const typedUnit = quickAdd.unit.toLowerCase() as Unit;
    const unit = ACCEPTED_UNITS.includes(typedUnit) ? typedUnit : "pcs";
    await addOrUpdate({
      fragmentId: activeFragment.id,
      name: quickAdd.name,
      brand: quickAdd.brand || undefined,
      barcode: quickAdd.barcode || undefined,
      baseQty: Number(quickAdd.quantity) || 1,
      baseUnit: unit,
      displayQty: Number(quickAdd.quantity) || 1,
      displayUnit: unit,
    });
    setQuickAdd({
      name: "",
      brand: "",
      quantity: "1",
      unit: "pcs",
      barcode: "",
    });
  };

  const renderItem = useCallback(
    ({ item }: { item: typeof items[number] }) => (
      <TouchableOpacity
        className="mb-3 rounded-2xl bg-surface-raised p-4"
        onPress={() => navigation.navigate("PantryDetail", { itemId: item.id })}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-semibold text-black">
              {item.name}
            </Text>
            {item.brand ? (
              <Text className="text-sm text-neutral-600">{item.brand}</Text>
            ) : null}
            {item.barcode ? (
              <Text className="text-xs text-neutral-500">
                Barcode: {item.barcode}
              </Text>
            ) : null}
          </View>
          <QuantityBadge
            baseQty={item.baseQty}
            baseUnit={item.baseUnit}
            displayQty={item.displayQty}
            displayUnit={item.displayUnit}
          />
        </View>
      </TouchableOpacity>
    ),
    [navigation]
  );

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
        <Toolbar
          title={activeFragment ? activeFragment.title : "Pantry"}
          trailing={
            <TouchableOpacity
              className="rounded-full border border-neutral-700 px-3 py-1"
              onPress={() => navigation.navigate("PantryEdit")}
            >
              <Text className="text-sm font-semibold text-white">Add Item</Text>
            </TouchableOpacity>
          }
        />

        <View className="mb-4 flex-row gap-2">
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              className={`flex-1 rounded-full py-2 ${
                activeFilter === filter ? "bg-accent/20" : "bg-surface-muted"
              }`}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeFilter === filter
                    ? "text-accent"
                    : "text-neutral-400"
                }`}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="rounded-2xl bg-surface-muted p-4">
          <Text className="text-sm font-semibold text-neutral-200">
            Quick Add
          </Text>
          <View className="mt-3 gap-3">
            <TextInput
              placeholder="Name"
              placeholderTextColor="#666"
              value={quickAdd.name}
              onChangeText={(text) =>
                setQuickAdd((prev) => ({ ...prev, name: text }))
              }
              className="rounded-xl border border-neutral-300 px-3 py-2"
              style={{ color: "#111" }}
            />
            <TextInput
              placeholder="Brand (optional)"
              placeholderTextColor="#666"
              value={quickAdd.brand}
              onChangeText={(text) =>
                setQuickAdd((prev) => ({ ...prev, brand: text }))
              }
              className="rounded-xl border border-neutral-300 px-3 py-2"
              style={{ color: "#111" }}
            />
            <View className="flex-row gap-3">
              <TextInput
                placeholder="Qty"
                placeholderTextColor="#666"
                value={quickAdd.quantity}
                onChangeText={(text) =>
                  setQuickAdd((prev) => ({ ...prev, quantity: text }))
                }
                keyboardType="numeric"
                className="flex-1 rounded-xl border border-neutral-300 px-3 py-2"
                style={{ color: "#111" }}
              />
              <TextInput
                placeholder="Unit (g/ml/pcs)"
                placeholderTextColor="#666"
                value={quickAdd.unit}
                onChangeText={(text) =>
                  setQuickAdd((prev) => ({ ...prev, unit: text }))
                }
                className="w-24 rounded-xl border border-neutral-300 px-3 py-2"
                style={{ color: "#111" }}
              />
            </View>
            <TextInput
              placeholder="Barcode"
              placeholderTextColor="#666"
              value={quickAdd.barcode}
              onChangeText={(text) =>
                setQuickAdd((prev) => ({ ...prev, barcode: text }))
              }
              className="rounded-xl border border-neutral-300 px-3 py-2"
              style={{ color: "#111" }}
            />
            <TouchableOpacity
              className="rounded-xl bg-accent/20 py-2"
              onPress={onQuickAdd}
            >
              <Text className="text-center text-sm font-semibold text-accent">
                Save Quick Item
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-4 flex-row items-center gap-2">
          <TextInput
            placeholder="Search pantry..."
            placeholderTextColor="#666"
            className="flex-1 rounded-full bg-surface-muted px-4 py-2"
            style={{ color: "#111" }}
            onChangeText={(text) => searchItems(text)}
          />
          <TouchableOpacity
            className="rounded-full border border-neutral-800 px-3 py-2"
            onPress={() =>
              setSort(sort === "name_asc" ? "name_desc" : "name_asc")
            }
          >
            <Text className="text-sm text-neutral-200">
              {sort === "name_asc" ? "Name A–Z" : "Name Z–A"}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-4" style={{ minHeight: 300 }}>
          {items.length === 0 ? (
            <EmptyState
              title="Nothing tracked yet"
              message="Add items to see them listed here."
            />
          ) : (
            <FlashList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              estimatedItemSize={90}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        className="absolute bottom-6 right-6 rounded-full bg-accent px-5 py-4"
        onPress={() => navigation.navigate("PantryEdit")}
      >
        <Text className="text-3xl font-semibold text-surface">+</Text>
      </TouchableOpacity>
    </View>
  );
};
