import type { PropsWithChildren } from "react";
import { View, Text } from "react-native";

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
}>;

export const Card = ({ title, subtitle, children }: CardProps) => (
  <View className="mb-3 rounded-2xl bg-surface-raised p-4">
    {title ? (
      <Text className="text-lg font-semibold text-black">{title}</Text>
    ) : null}
    {subtitle ? (
      <Text className="text-sm text-neutral-400">{subtitle}</Text>
    ) : null}
    <View className="mt-3">{children}</View>
  </View>
);
