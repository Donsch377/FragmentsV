import type { ReactNode } from "react";
import { View, Text } from "react-native";

type ToolbarProps = {
  title: string;
  trailing?: ReactNode;
};

export const Toolbar = ({ title, trailing }: ToolbarProps) => (
  <View className="mb-4 flex-row items-center justify-between">
    <Text className="text-2xl font-semibold text-black">{title}</Text>
    {trailing}
  </View>
);
