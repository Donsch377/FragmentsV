import type { ReactNode } from "react";
import { View, Text } from "react-native";

type EmptyStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
};

export const EmptyState = ({ title, message, action }: EmptyStateProps) => (
  <View className="items-center rounded-2xl border border-dashed border-neutral-700 bg-surface-muted p-6">
    <Text className="text-base font-semibold text-white">{title}</Text>
    {message ? (
      <Text className="mt-2 text-center text-sm text-neutral-400">
        {message}
      </Text>
    ) : null}
    {action ? <View className="mt-4">{action}</View> : null}
  </View>
);
