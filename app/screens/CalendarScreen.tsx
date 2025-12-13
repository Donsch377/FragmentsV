import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabaseClient";
import type { TaskRecord } from "../types/tasks";
import { TaskModal } from "../components/TaskModal";
import { useAuth } from "../providers/AuthProvider";
import type { FoodLogEntry } from "../types/food";
import { FoodLogModal } from "../components/FoodLogModal";
import { FoodLogDetailsModal } from "../components/FoodLogDetailsModal";

type RangeOption = "Day" | "Week" | "Month";

const RANGE_OPTIONS: RangeOption[] = ["Day", "Week", "Month"];

type ServingField = keyof NonNullable<FoodLogEntry["serving"]>;

type NutritionMetric =
  | "Calories"
  | "Protein"
  | "Carbs"
  | "Fat"
  | "Fiber"
  | "Sodium"
  | "Potassium"
  | "Sugar";

const DEFAULT_NUTRITION_METRICS: NutritionMetric[] = [];

const NUTRITION_FIELD_MAP: Record<
  NutritionMetric,
  { field: ServingField | null; unit: string }
> = {
  Calories: { field: "energy_kcal", unit: "kcal" },
  Protein: { field: "protein_g", unit: "g" },
  Carbs: { field: "carbs_g", unit: "g" },
  Fat: { field: "fat_g", unit: "g" },
  Fiber: { field: "fiber_g", unit: "g" },
  Sodium: { field: "sodium_mg", unit: "mg" },
  Potassium: { field: null, unit: "mg" },
  Sugar: { field: "sugar_g", unit: "g" },
};

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

const formatDateKey = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const year = normalized.getFullYear();
  const month = `${normalized.getMonth() + 1}`.padStart(2, "0");
  const day = `${normalized.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const RANGE_DAY_COUNT: Record<RangeOption, number> = {
  Day: 0,
  Week: 7,
  Month: 0,
};

const getUpcomingDates = (count: number) => {
  const today = new Date();
  return Array.from({ length: count }).map((_, index) => {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + index);
    return nextDate;
  });
};

const buildMonthCalendar = (reference: Date): (Date | null)[] => {
  const startOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const daysInMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  const leadingEmpty = startOfMonth.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(reference.getFullYear(), reference.getMonth(), day));
  }
  const trailingCells = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailingCells; i += 1) {
    cells.push(null);
  }
  return cells;
};

const chunkIntoWeeks = (cells: (Date | null)[]) => {
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
};

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  if (typeof value === "string" && value.includes("T")) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  if (typeof value === "string") {
    const pieces = value.split("-");
    if (pieces.length === 3) {
      const year = Number(pieces[0]);
      const month = Number(pieces[1]) - 1;
      const day = Number(pieces[2]);
      if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
        const parsed = new Date(year, month, day);
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
  }
  const fallback = new Date(value as string);
  if (Number.isNaN(fallback.getTime())) return null;
  fallback.setHours(0, 0, 0, 0);
  return fallback;
};

export const CalendarScreen = () => {
  const { session } = useAuth();
  const [range, setRange] = useState<RangeOption>("Day");
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
  const [rawTasks, setRawTasks] = useState<TaskRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [foodLogsLoading, setFoodLogsLoading] = useState(false);
  const [foodLogModalVisible, setFoodLogModalVisible] = useState(false);
  const [foodLogsAvailable, setFoodLogsAvailable] = useState(true);
  const [selectedFoodLog, setSelectedFoodLog] = useState<FoodLogEntry | null>(null);
  const [nutritionMetrics, setNutritionMetrics] = useState<NutritionMetric[]>(DEFAULT_NUTRITION_METRICS);
  const [nutritionPrefsLoading, setNutritionPrefsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [userLabels, setUserLabels] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const now = new Date();
  const monthCells = useMemo(() => buildMonthCalendar(selectedMonthDate), [selectedMonthDate]);
  const monthWeeks = useMemo(() => chunkIntoWeeks(monthCells), [monthCells]);
  const multiDayData = useMemo(() => {
    const count = RANGE_DAY_COUNT[range];
    if (!count) return [];
    return getUpcomingDates(count);
  }, [range]);

  const isTaskActiveOnDate = (task: TaskRecord, date: Date) => {
    const targetTime = startOfDay(date).getTime();
    const startDate = toDateOnly(task.start_at ?? task.start_date);
    const dueDate = toDateOnly(task.due_at ?? task.due_date);
    if (startDate && targetTime < startDate.getTime()) return false;
    if (dueDate && targetTime > dueDate.getTime()) return false;
    return true;
  };

  const getTasksForDate = (date: Date, includeCompleted = false) =>
    tasks.filter((task) => {
      if (!includeCompleted && task.completed) return false;
      return isTaskActiveOnDate(task, date);
    });
  const describeLinkTargets = (task: TaskRecord) => {
    if (!task.link_type) return null;
    const labels = task.link_type
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1));
    if (!labels.length) return null;
    return labels.join(" + ");
  };
  const formatAssignees = (task: TaskRecord) =>
    task.assignee_names?.length ? `Assigned to ${task.assignee_names.join(", ")}` : "";
  const resolveFoodName = (log: FoodLogEntry) => log.food?.name ?? log.food_name ?? "Food item";
  const resolveFoodGroup = (log: FoodLogEntry) => log.food?.group_name ?? log.food_group_name ?? null;
  const resolveServingLabel = (log: FoodLogEntry) => log.serving?.label ?? log.serving_label ?? "Serving";
  const resolveServingAmount = (log: FoodLogEntry) =>
    log.serving?.amount ?? log.serving_amount ?? null;
  const resolveServingUnit = (log: FoodLogEntry) => log.serving?.unit ?? log.serving_unit ?? null;
  const getNutrientValue = (entry: FoodLogEntry, field: ServingField): number | null => {
    const fromServing = entry.serving?.[field];
    if (typeof fromServing === "number") {
      return fromServing;
    }
    const fallback = entry[field];
    if (typeof fallback === "number") {
      return fallback;
    }
    if (typeof fallback === "string") {
      const parsed = Number(fallback);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const describeFoodLog = useCallback((log: FoodLogEntry) => {
    const quantityValue =
      typeof log.quantity === "number" && Number.isFinite(log.quantity)
        ? log.quantity
        : Number(log.quantity ?? 0) || 0;
    const servingLabel = resolveServingLabel(log);
    const servingsLabel = `${quantityValue || 0} × ${servingLabel}`;
    const amountValue = resolveServingAmount(log);
    const unitValue = resolveServingUnit(log);
    const amountLabel =
      amountValue !== null && amountValue !== undefined
        ? `${amountValue}${unitValue ? ` ${unitValue}` : ""}`
        : null;
    const groupLabel = resolveFoodGroup(log);
    return [servingsLabel, amountLabel, groupLabel].filter(Boolean).join(" · ");
  }, []);
  const renderTodayView = () => {
    const todaysTasks = getTasksForDate(now, true);
    return (
      <>
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Today’s Eating</Text>
            <TouchableOpacity
              style={[styles.taskButton, !foodLogsAvailable && styles.taskButtonDisabled]}
              onPress={() => setFoodLogModalVisible(true)}
              disabled={!foodLogsAvailable}
            >
              <Text style={styles.taskButtonText}>Log food</Text>
            </TouchableOpacity>
          </View>
          {!foodLogsAvailable ? (
            <Text style={styles.sectionSubheading}>
              Food logging isn’t ready yet. Run ./fragments-supabase/supabase-start.sh to refresh the database schema.
            </Text>
          ) : (
            <>
              {nutritionMetrics.length ? (
                <View style={styles.nutritionChipRow}>
                  {nutritionMetrics.map((metric) => (
                    <View key={metric} style={styles.nutritionChip}>
                      <Text style={styles.nutritionChipLabel}>{metric}</Text>
                      <Text style={styles.nutritionChipValue}>
                        {nutritionPrefsLoading && foodLogsLoading
                          ? "Loading…"
                          : formatNutritionValue(metric, nutritionTotals[metric] ?? null)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {foodLogsLoading ? (
                <Text style={styles.sectionSubheading}>Loading meals...</Text>
              ) : foodLogs.length === 0 ? (
                <Text style={styles.sectionSubheading}>No meals logged yet.</Text>
              ) : (
                foodLogs.map((entry) => (
                  <View key={entry.id} style={styles.mealRow}>
                    <TouchableOpacity style={styles.mealInfo} onPress={() => setSelectedFoodLog(entry)}>
                      <Text style={styles.mealName}>{resolveFoodName(entry)}</Text>
                      <Text style={styles.mealMeta}>{describeFoodLog(entry)}</Text>
                      {entry.notes ? <Text style={styles.mealMeta}>{entry.notes}</Text> : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mealDeleteButton,
                        deletingLogId === entry.id && styles.mealDeleteButtonDisabled,
                      ]}
                      onPress={() => confirmDeleteFoodLog(entry)}
                      disabled={deletingLogId === entry.id}
                    >
                      <Text style={styles.mealDeleteText}>
                        {deletingLogId === entry.id ? "Deleting…" : "Delete"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Today’s Tasks</Text>
            <TouchableOpacity style={styles.taskButton} onPress={() => setTaskModalVisible(true)}>
              <Text style={styles.taskButtonText}>Create task</Text>
            </TouchableOpacity>
          </View>
          {tasksLoading ? (
            <Text style={styles.sectionSubheading}>Loading tasks...</Text>
          ) : todaysTasks.length === 0 ? (
            <Text style={styles.sectionSubheading}>No tasks yet.</Text>
          ) : (
            todaysTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskRow, task.completed && styles.taskRowDone]}
                onPress={() => toggleTaskCompleted(task)}
              >
                <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
                  {task.completed ? <Text style={styles.checkboxIcon}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskMeta}>
                    Starts {task.start_at ? new Date(task.start_at).toLocaleString() : task.start_date || "now"} · Due{" "}
                    {task.due_at ? new Date(task.due_at).toLocaleString() : task.due_date || "unset"}
                  </Text>
                  {task.assignee_names?.length ? <Text style={styles.taskMeta}>{formatAssignees(task)}</Text> : null}
                  {task.link_type ? (
                    <Text style={styles.taskMeta}>
                      Linked to {describeLinkTargets(task)}: {task.linked_text || "—"}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.deletePill} onPress={() => confirmDeleteTask(task.id)}>
                  <Text style={styles.deletePillText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      </>
    );
  };

  const renderMultiDayCard = ({ item }: { item: Date }) => {
    const dateObj = item;
    const includeCompleted = formatDateKey(dateObj) === formatDateKey(now);
    const dayTasks = getTasksForDate(dateObj, includeCompleted);
    return (
      <View style={styles.dayCard}>
        <Text style={styles.dayCardDate}>{formatDate(dateObj)}</Text>
        <View style={styles.dayCardDivider} />
        <View>
          <Text style={styles.cardSectionLabel}>Tasks</Text>
          {dayTasks.length === 0 ? (
            <Text style={styles.cardListItem}>No tasks recorded yet</Text>
          ) : (
            dayTasks.map((task) => (
              <View key={task.id} style={styles.dayTaskRow}>
                <Text style={styles.dayTaskTitle}>{task.title}</Text>
                <Text style={styles.dayTaskMeta}>
                  {task.due_at
                    ? new Date(task.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : task.due_date || "No due date"}
                  {task.assignee_names?.length ? ` · ${task.assignee_names.join(", ")}` : ""}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

const renderMonthView = () => (
    <View style={styles.monthContainer}>
      <View style={styles.monthHeader}>
        <Text style={styles.sectionHeading}>
          {selectedMonthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </Text>
      </View>
      <View style={styles.weekdayRow}>
        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {monthWeeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((cell, cellIndex) => {
              const isSelected =
                cell && selectedMonthDate && cell.toDateString() === selectedMonthDate.toDateString();
              return (
                <TouchableOpacity
                  key={`${cell ? cell.getDate() : "empty"}-${weekIndex}-${cellIndex}`}
                  style={[
                    styles.gridCell,
                    cell ? styles.gridCellActive : styles.gridCellEmpty,
                    isSelected && styles.gridCellSelected,
                  ]}
                  activeOpacity={0.8}
                  disabled={!cell}
                  onPress={() => {
                    if (cell) {
                      setSelectedMonthDate(cell);
                    }
                  }}
                >
                  {cell ? <Text style={styles.gridCellText}>{cell.getDate()}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={[styles.section, styles.monthDetail]}>
        <Text style={styles.sectionHeading}>{formatDate(selectedMonthDate)}</Text>
        {(() => {
          const includeCompleted = formatDateKey(selectedMonthDate) === formatDateKey(now);
          const dayTasks = getTasksForDate(selectedMonthDate, includeCompleted);
          if (dayTasks.length === 0) {
            return <Text style={styles.sectionSubheading}>No tasks logged for this day.</Text>;
          }
          return dayTasks.map((task) => (
            <View key={task.id} style={styles.dayTaskRow}>
              <Text style={styles.dayTaskTitle}>{task.title}</Text>
              <Text style={styles.dayTaskMeta}>
                {task.due_at
                  ? new Date(task.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : task.due_date || "No due date"}
                {task.assignee_names?.length ? ` · ${task.assignee_names.join(", ")}` : ""}
              </Text>
            </View>
          ));
        })()}
      </View>
    </View>
  );

  const loadTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("start_at", { ascending: true, nullsFirst: false })
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      setRawTasks(data ?? []);
    } catch (error) {
      console.error("Failed to load tasks", error);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadFoodLogs = useCallback(async () => {
    if (!session?.user?.id) {
      setFoodLogs([]);
      return;
    }
    try {
      setFoodLogsLoading(true);
      const todayKey = formatDateKey(new Date());
      const { data, error } = await supabase
        .from("food_logs")
        .select(
          "*, food:foods(id, name, group_name, image_url), serving:food_servings(id, food_id, label, amount, unit, energy_kcal, protein_g, carbs_g, fat_g, sat_fat_g, trans_fat_g, fiber_g, sugar_g, sodium_mg)",
        )
        .eq("logged_date", todayKey)
        .order("inserted_at", { ascending: false });
      if (error) throw error;
      setFoodLogsAvailable(true);
      setFoodLogs(data ?? []);
    } catch (error) {
      console.error("Failed to load food logs", error);
      if ((error as any)?.code === "PGRST205") {
        setFoodLogsAvailable(false);
        return;
      }
    } finally {
      setFoodLogsLoading(false);
    }
  }, [session?.user?.id]);

  const loadNutritionPreferences = useCallback(async () => {
    if (!session?.user?.id) {
      setNutritionMetrics(DEFAULT_NUTRITION_METRICS);
      return;
    }
    try {
      setNutritionPrefsLoading(true);
      const { data, error } = await supabase
        .from("nutrition_preferences")
        .select("metrics")
        .eq("profile_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data?.metrics && Array.isArray(data.metrics)) {
        const filtered = (data.metrics as string[]).filter((entry): entry is NutritionMetric =>
          Object.prototype.hasOwnProperty.call(NUTRITION_FIELD_MAP, entry),
        );
        setNutritionMetrics(filtered.length ? filtered : DEFAULT_NUTRITION_METRICS);
      } else {
        setNutritionMetrics(DEFAULT_NUTRITION_METRICS);
      }
    } catch (error) {
      console.error("Failed to load nutrition preferences", error);
      setNutritionMetrics(DEFAULT_NUTRITION_METRICS);
    } finally {
      setNutritionPrefsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadFoodLogs();
  }, [loadFoodLogs]);

  useFocusEffect(
    useCallback(() => {
      loadNutritionPreferences();
    }, [loadNutritionPreferences]),
  );

  useEffect(() => {
    if (!session?.user) {
      setUserLabels([]);
      return;
    }
    let cancelled = false;
    const loadProfile = async () => {
      const labels = new Set<string>();
      if (session.user.email) labels.add(session.user.email.toLowerCase());
      const fullName = session.user.user_metadata?.full_name;
      if (fullName) labels.add(fullName.toLowerCase());
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", session.user.id)
          .maybeSingle();
        if (data?.display_name) labels.add(data.display_name.toLowerCase());
      } catch (error) {
        console.error("Failed to load profile for calendar", error);
      }
      if (!cancelled) {
        setUserLabels(Array.from(labels).filter(Boolean));
      }
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadTasks(), loadFoodLogs(), loadNutritionPreferences()]);
    setRefreshing(false);
  }, [loadTasks, loadFoodLogs, loadNutritionPreferences]);

  const deleteFoodLog = useCallback(
    async (entryId: string) => {
      try {
        setDeletingLogId(entryId);
        const { error } = await supabase.from("food_logs").delete().eq("id", entryId);
        if (error) throw error;
        if (selectedFoodLog?.id === entryId) {
          setSelectedFoodLog(null);
        }
        await loadFoodLogs();
      } catch (error) {
        console.error("Failed to delete food log", error);
        Alert.alert("Unable to delete entry", "Please try again.");
      } finally {
        setDeletingLogId((current) => (current === entryId ? null : current));
      }
    },
    [loadFoodLogs, selectedFoodLog?.id],
  );

  const confirmDeleteFoodLog = useCallback(
    (entry: FoodLogEntry) => {
      Alert.alert(
        "Delete log?",
        `Remove ${resolveFoodName(entry)} from ${entry.logged_date ?? "today"}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteFoodLog(entry.id) },
        ],
      );
    },
    [deleteFoodLog],
  );

  const applyAssigneeFilter = useCallback(
    (records: TaskRecord[]) => {
      if (!userLabels.length) return records;
      return records.filter((task) => {
        if (!task.assignee_names || task.assignee_names.length === 0) return true;
        const normalized = task.assignee_names.map((name) => name.toLowerCase());
        return normalized.some((name) => userLabels.includes(name));
      });
    },
    [userLabels],
  );

  useEffect(() => {
    setTasks(applyAssigneeFilter(rawTasks));
  }, [rawTasks, applyAssigneeFilter]);

  const nutritionTotals = useMemo(() => {
    const totals: Record<NutritionMetric, number | null> = {} as Record<NutritionMetric, number | null>;
    nutritionMetrics.forEach((metric) => {
      const field = NUTRITION_FIELD_MAP[metric].field;
      totals[metric] = field ? 0 : null;
    });
    if (!foodLogs.length) {
      return totals;
    }
    foodLogs.forEach((log) => {
      const quantityValue = Number(log.quantity ?? 0) || 0;
      if (!quantityValue) return;
      nutritionMetrics.forEach((metric) => {
        const field = NUTRITION_FIELD_MAP[metric].field;
        if (!field) return;
        const baseValue = getNutrientValue(log, field);
        if (baseValue === null) return;
        const numericBase = baseValue;
        if (!Number.isFinite(numericBase)) {
          return;
        }
        totals[metric] = (totals[metric] ?? 0) + numericBase * quantityValue;
      });
    });
    return totals;
  }, [foodLogs, nutritionMetrics]);

  const formatNutritionValue = (metric: NutritionMetric, value: number | null) => {
    if (value === null) {
      return "Not tracked";
    }
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isFinite(rounded) ? rounded : 0} ${NUTRITION_FIELD_MAP[metric].unit}`;
  };

  const toggleTaskCompleted = async (task: TaskRecord) => {
    const previous = rawTasks;
    setRawTasks((current) =>
      current.map((entry) => (entry.id === task.id ? { ...entry, completed: !task.completed } : entry)),
    );
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ completed: !task.completed })
        .eq("id", task.id);
      if (error) throw error;
    } catch (error) {
      console.error("Unable to toggle task", error);
      setRawTasks(previous);
    }
  };

  const deleteTask = async (taskId: string) => {
    const previous = rawTasks;
    setRawTasks((current) => current.filter((task) => task.id !== taskId));
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    } catch (error) {
      console.error("Unable to delete task", error);
      setRawTasks(previous);
      Alert.alert("Unable to delete", "Please try again.");
    }
  };

  const confirmDeleteTask = (taskId: string) => {
    Alert.alert("Delete task?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteTask(taskId),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#ffffff" />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.dateText}>{formatDate(new Date())}</Text>
        </View>

        <View style={styles.rangeSelector}>
          {RANGE_OPTIONS.map((option) => {
            const isActive = option === range;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.rangeButton, isActive && styles.rangeButtonActive]}
                onPress={() => setRange(option)}
              >
                <Text style={[styles.rangeButtonText, isActive && styles.rangeButtonTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {range === "Day" ? (
          renderTodayView()
        ) : range === "Month" ? (
          renderMonthView()
        ) : (
          <FlatList
            data={multiDayData}
            keyExtractor={(item) => formatDateKey(item)}
            renderItem={renderMultiDayCard}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 16 }}
          />
        )}
      </ScrollView>
      {foodLogsAvailable ? (
        <FoodLogModal
          visible={foodLogModalVisible}
          onClose={() => setFoodLogModalVisible(false)}
          onLogged={() => {
            setFoodLogModalVisible(false);
            loadFoodLogs();
          }}
          targetDate={formatDateKey(new Date())}
        />
      ) : null}
      <FoodLogDetailsModal
        visible={Boolean(selectedFoodLog)}
        entry={selectedFoodLog}
        onClose={() => setSelectedFoodLog(null)}
      />
      <TaskModal
        visible={taskModalVisible}
        onClose={() => setTaskModalVisible(false)}
        onSaved={loadTasks}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
  },
  dateText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
  },
  rangeSelector: {
    flexDirection: "row",
    borderRadius: 999,
    backgroundColor: "#0a0f1a",
    padding: 3,
    justifyContent: "space-between",
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
  },
  rangeButtonActive: {
    backgroundColor: "#1b2337",
  },
  rangeButtonText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  rangeButtonTextActive: {
    color: "#ffffff",
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0a101b",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionSubheading: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  taskButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  taskButtonDisabled: {
    opacity: 0.4,
  },
  nutritionChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  nutritionChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(15,176,106,0.06)",
  },
  nutritionChipLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  nutritionChipValue: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  taskButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  mealRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600",
  },
  mealMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  taskRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#0fb06a",
    borderColor: "#0fb06a",
  },
  checkboxIcon: {
    color: "#050505",
    fontWeight: "700",
  },
  taskText: {
    color: "#ffffff",
    fontSize: 15,
  },
  taskTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  taskMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  deletePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deletePillText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
  },
  mealDeleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.7)",
  },
  mealDeleteButtonDisabled: {
    opacity: 0.5,
  },
  mealDeleteText: {
    color: "#f87171",
    fontWeight: "700",
    fontSize: 12,
  },
  taskDone: {
    color: "rgba(255,255,255,0.4)",
    textDecorationLine: "line-through",
  },
  dayCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0a101b",
    padding: 18,
  },
  dayCardDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  dayCardDivider: {
    marginVertical: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cardSectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.45)",
  },
  cardListItem: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 14,
  },
  dayTaskRow: {
    marginTop: 8,
    gap: 2,
  },
  dayTaskTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  dayTaskMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  monthContainer: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0a101b",
    padding: 20,
  },
  monthHeader: {
    marginBottom: 12,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  grid: {
    rowGap: 12,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  gridCellActive: {
    borderRadius: 16,
  },
  gridCellEmpty: {
    opacity: 0.2,
  },
  gridCellSelected: {
    backgroundColor: "#1b2337",
  },
  gridCellText: {
    color: "#ffffff",
    fontSize: 16,
  },
  gridDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0fb06a",
    position: "absolute",
    bottom: 6,
  },
  monthDetail: {
    marginTop: 20,
  },
});
