import { useEffect, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { getLogs, clearLogs } from "../utils/logger";
import { reseedData, clearAllData, getTableCounts } from "../db/seed";

export const DebugScreen = () => {
  const [logs, setLogs] = useState(getLogs());
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refreshCounts = async () => {
    const data = await getTableCounts();
    setCounts(data);
  };

  useEffect(() => {
    refreshCounts();
  }, []);

  const refreshLogs = () => setLogs(getLogs());

  return (
    <ScrollView className="flex-1 bg-surface p-4">
      <View className="rounded-3xl bg-surface-muted p-4">
        <Text className="text-xl font-semibold text-white">Debug Tools</Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          <TouchableOpacity
            className="rounded-2xl bg-accent/20 px-4 py-2"
            onPress={async () => {
              await reseedData();
              refreshCounts();
            }}
          >
            <Text className="text-accent">Re-seed DB</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-2xl bg-red-500/20 px-4 py-2"
            onPress={async () => {
              await clearAllData();
              refreshCounts();
            }}
          >
            <Text className="text-red-400">Clear Tables</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-2xl border border-neutral-700 px-4 py-2"
            onPress={refreshCounts}
          >
            <Text className="text-neutral-200">Refresh Counts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-2xl border border-neutral-700 px-4 py-2"
            onPress={() => {
              clearLogs();
              refreshLogs();
            }}
          >
            <Text className="text-neutral-200">Clear Logs</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="mt-4 rounded-3xl bg-surface-muted p-4">
        <Text className="text-base font-semibold text-neutral-200">
          Table Counts
        </Text>
        {Object.entries(counts).map(([table, count]) => (
          <View
            key={table}
            className="mt-2 flex-row items-center justify-between"
          >
            <Text className="text-neutral-400">{table}</Text>
            <Text className="text-white">{count}</Text>
          </View>
        ))}
      </View>

      <View className="mt-4 rounded-3xl bg-surface-muted p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-neutral-200">
            Recent Logs
          </Text>
          <TouchableOpacity onPress={refreshLogs}>
            <Text className="text-sm text-accent">Refresh</Text>
          </TouchableOpacity>
        </View>
        {logs.length === 0 ? (
          <Text className="text-neutral-500">No logs yet.</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} className="border-b border-neutral-800 py-2">
              <Text className="text-xs uppercase text-neutral-500">
                {log.level.toUpperCase()} —{" "}
                {new Date(log.timestamp).toLocaleTimeString()}
              </Text>
              <Text className="text-sm text-neutral-200">{log.message}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};
