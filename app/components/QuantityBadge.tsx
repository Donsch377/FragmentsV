import { Text, View } from "react-native";
import type { Unit } from "../models/types";
import { formatQuantity } from "../utils/format";

type QuantityBadgeProps = {
  baseQty: number;
  baseUnit: Unit;
  displayQty?: number | null;
  displayUnit?: Unit | null;
};

export const QuantityBadge = ({
  baseQty,
  baseUnit,
  displayQty,
  displayUnit,
}: QuantityBadgeProps) => {
  const label = displayQty
    ? `${formatQuantity(displayQty, displayUnit ?? baseUnit)}`
    : `${formatQuantity(baseQty, baseUnit)}`;

  return (
    <View className="rounded-full bg-accent/10 px-3 py-1">
      <Text className="text-xs font-semibold uppercase tracking-wider text-accent">
        {label}
      </Text>
    </View>
  );
};
