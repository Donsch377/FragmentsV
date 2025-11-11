import { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  fragmentItemInputSchema,
  type FragmentItem,
} from "../models/zodSchemas";
import type { PantryStackProps } from "../navigation/PantryStack";
import { useInventoryStore } from "../stores/useInventoryStore";
import { inventoryRepo } from "../repos/inventoryRepo";
import { scanOnce, pickImage } from "../features/scanning";

const formSchema = fragmentItemInputSchema;

type FormValues = Omit<FragmentItem, "id"> & { id?: string };

export const PantryEditScreen = ({
  route,
  navigation,
}: PantryStackProps<"PantryEdit">) => {
  const { itemId } = route.params ?? {};
  const { addOrUpdate, activePantryFragmentId } = useInventoryStore();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: undefined,
      fragmentId: activePantryFragmentId ?? "",
      name: "",
      brand: "",
      barcode: "",
      baseQty: 1,
      baseUnit: "pcs",
      displayQty: 1,
      displayUnit: "pcs",
      notes: "",
    },
  });

  useEffect(() => {
    if (itemId) {
      inventoryRepo.getItem(itemId).then((item) => {
        if (item) {
          reset({
            ...item,
            notes: item.notes ?? "",
          });
        }
      });
    }
  }, [itemId, reset]);

  useEffect(() => {
    if (activePantryFragmentId) {
      setValue("fragmentId", activePantryFragmentId);
    }
  }, [activePantryFragmentId, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!activePantryFragmentId) {
      Alert.alert("Select a pantry fragment first.");
      return;
    }
    await addOrUpdate({
      ...values,
      fragmentId: activePantryFragmentId,
    });
    navigation.goBack();
  };

  const onScan = async () => {
    const value = await scanOnce();
    if (value) {
      setValue("barcode", value);
    }
  };

  const onPickImage = async () => {
    const uri = await pickImage();
    if (uri) {
      Alert.alert("Image captured", uri);
    }
  };

  return (
    <ScrollView className="flex-1 bg-surface p-4">
      <View className="gap-4">
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange } }) => (
            <TextInput
              placeholder="Name"
              placeholderTextColor="#666"
              value={value}
              onChangeText={onChange}
              className="rounded-2xl bg-surface-muted px-4 py-3"
              style={{ color: "#111" }}
            />
          )}
        />
        {errors.name ? (
          <Text className="text-sm text-red-400">{errors.name.message}</Text>
        ) : null}

        <Controller
          control={control}
          name="brand"
          render={({ field: { value, onChange } }) => (
            <TextInput
              placeholder="Brand"
              placeholderTextColor="#666"
              value={value ?? ""}
              onChangeText={onChange}
              className="rounded-2xl bg-surface-muted px-4 py-3"
              style={{ color: "#111" }}
            />
          )}
        />

        <View className="flex-row gap-3">
          <Controller
            control={control}
            name="barcode"
            render={({ field: { value, onChange } }) => (
              <TextInput
                placeholder="Barcode"
                placeholderTextColor="#666"
                value={value ?? ""}
                onChangeText={onChange}
                className="flex-1 rounded-2xl bg-surface-muted px-4 py-3"
                style={{ color: "#111" }}
              />
            )}
          />
          <TouchableOpacity
            className="rounded-2xl bg-accent/20 px-4 py-3"
            onPress={onScan}
          >
            <Text className="text-center text-sm font-semibold text-accent">
              Scan
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="rounded-2xl border border-dashed border-neutral-700 px-4 py-3"
          onPress={onPickImage}
        >
          <Text className="text-center text-neutral-300">
            Pick Image (stub)
          </Text>
        </TouchableOpacity>

        <View className="flex-row gap-3">
          <Controller
            control={control}
            name="baseQty"
            render={({ field: { value, onChange } }) => (
              <TextInput
                placeholder="Base Qty"
                placeholderTextColor="#666"
                value={String(value)}
                onChangeText={(text) => onChange(Number(text) || 0)}
                keyboardType="numeric"
                className="flex-1 rounded-2xl bg-surface-muted px-4 py-3"
                style={{ color: "#111" }}
              />
            )}
          />
          <Controller
            control={control}
            name="baseUnit"
            render={({ field: { value, onChange } }) => (
              <TextInput
                placeholder="Base Unit"
                placeholderTextColor="#666"
                value={value}
                onChangeText={onChange}
                className="w-24 rounded-2xl bg-surface-muted px-4 py-3"
                style={{ color: "#111" }}
              />
            )}
          />
        </View>

        <View className="flex-row gap-3">
          <Controller
            control={control}
            name="displayQty"
            render={({ field: { value, onChange } }) => (
              <TextInput
                placeholder="Display Qty"
                placeholderTextColor="#666"
                value={value ? String(value) : ""}
                onChangeText={(text) =>
                  onChange(text ? Number(text) : undefined)
                }
                keyboardType="numeric"
                className="flex-1 rounded-2xl bg-surface-muted px-4 py-3"
                style={{ color: "#111" }}
              />
            )}
          />
          <Controller
            control={control}
            name="displayUnit"
            render={({ field: { value, onChange } }) => (
              <TextInput
                placeholder="Display Unit"
                placeholderTextColor="#666"
                value={value ?? ""}
                onChangeText={onChange}
                className="w-24 rounded-2xl bg-surface-muted px-4 py-3"
                style={{ color: "#111" }}
                style={{ color: "#fff" }}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange } }) => (
            <TextInput
              placeholder="Notes"
              placeholderTextColor="#666"
              value={value ?? ""}
              onChangeText={onChange}
              className="rounded-2xl bg-surface-muted px-4 py-3"
              style={{ color: "#111" }}
              multiline
            />
          )}
        />
      </View>

      <TouchableOpacity
        className="mt-6 rounded-2xl bg-accent py-4"
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="text-center text-lg font-semibold text-black">
          Save Item
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
