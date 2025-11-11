import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import type { PantryStackProps } from "../navigation/PantryStack";
import { inventoryRepo } from "../repos/inventoryRepo";
import type { FragmentItem } from "../models/zodSchemas";
import { QuantityBadge } from "../components/QuantityBadge";
import { useInventoryStore } from "../stores/useInventoryStore";

export const PantryDetailScreen = ({
  route,
  navigation,
}: PantryStackProps<"PantryDetail">) => {
  const { itemId } = route.params;
  const [item, setItem] = useState<FragmentItem | null>(null);
  const { remove } = useInventoryStore();

  useEffect(() => {
    inventoryRepo.getItem(itemId).then(setItem);
  }, [itemId]);

  const handleDelete = () => {
    if (!item) {
      return;
    }

    Alert.alert("Delete item?", item.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await remove(item.id);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-neutral-400">Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface p-4">
      <View className="rounded-3xl bg-surface-muted p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-semibold text-black">
              {item.name}
            </Text>
            {item.brand ? (
              <Text className="text-sm text-neutral-400">{item.brand}</Text>
            ) : null}
          </View>
          <QuantityBadge
            baseQty={item.baseQty}
            baseUnit={item.baseUnit}
            displayQty={item.displayQty}
            displayUnit={item.displayUnit}
          />
        </View>

        {item.barcode ? (
          <Text className="text-sm text-neutral-400">
            Barcode: {item.barcode}
          </Text>
        ) : null}
        {item.notes ? (
          <Text className="mt-3 text-neutral-300">{item.notes}</Text>
        ) : null}
      </View>

      <View className="mt-6 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 rounded-2xl bg-accent/20 py-3"
          onPress={() => navigation.navigate("PantryEdit", { itemId: item.id })}
        >
          <Text className="text-center font-semibold text-accent">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 rounded-2xl bg-red-500/20 py-3"
          onPress={handleDelete}
        >
          <Text className="text-center font-semibold text-red-400">
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
