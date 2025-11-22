import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type RangeOption = "1d" | "5d" | "7d" | "14d" | "Month";

type Meal = {
  id: string;
  time: string;
  name: string;
  calories: number;
};

type Task = {
  id: string;
  title: string;
  done: boolean;
};

type DaySnapshot = {
  date: string; // ISO
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: Meal[];
  tasks: Task[];
};

const RANGE_OPTIONS: RangeOption[] = ["1d", "5d", "7d", "14d", "Month"];

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

const toISODate = (date: Date) => date.toISOString().split("T")[0];

const generateMockData = (): DaySnapshot[] => {
  const today = new Date();
  return Array.from({ length: 21 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const mealsCount = 2 + (index % 3);
    const tasksCount = 2 + (index % 4);
    return {
      date: toISODate(date),
      calories: 1800 + index * 15,
      macros: {
        protein: 120 + index * 2,
        carbs: 160 + index * 3,
        fat: 60 + index,
      },
      meals: Array.from({ length: mealsCount }).map((__, mealIndex) => ({
        id: `meal-${index}-${mealIndex}`,
        time: `${8 + mealIndex * 3}:00`,
        name: ["Breakfast", "Lunch", "Dinner", "Snack"][mealIndex % 4],
        calories: 400 + mealIndex * 120,
      })),
      tasks: Array.from({ length: tasksCount }).map((__, taskIndex) => ({
        id: `task-${index}-${taskIndex}`,
        title: ["Prep veggies", "Shop proteins", "Wash containers", "Brew cold brew"][taskIndex % 4],
        done: taskIndex % 2 === 0,
      })),
    };
  });
};

const dailySnapshots = generateMockData();

export const CalendarScreen = () => {
  const [range, setRange] = useState<RangeOption>("1d");
  const today = toISODate(new Date());
  const todayData = useMemo(() => dailySnapshots.find((snapshot) => snapshot.date === today) ?? dailySnapshots[0], [today]);
  const multiDayData = useMemo(() => {
    switch (range) {
      case "5d":
        return dailySnapshots.slice(0, 5).reverse();
      case "7d":
        return dailySnapshots.slice(0, 7).reverse();
      case "14d":
        return dailySnapshots.slice(0, 14).reverse();
      default:
        return [];
    }
  }, [range]);

  const [selectedMonthDay, setSelectedMonthDay] = useState<number | null>(null);

  const now = new Date();
  const monthDays = useMemo(() => {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    const leadingEmpty = startOfMonth.getDay();
    const totalCells = Math.ceil((leadingEmpty + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }).map((_, index) => {
      const day = index - leadingEmpty + 1;
      if (day < 1 || day > daysInMonth) {
        return null;
      }
      return day;
    });
  }, [now]);

  const selectedDayData = useMemo(() => {
    if (!selectedMonthDay) return null;
    const selectedDate = toISODate(new Date(now.getFullYear(), now.getMonth(), selectedMonthDay));
    return dailySnapshots.find((snapshot) => snapshot.date === selectedDate);
  }, [selectedMonthDay, now]);

  const renderMealRow = (meal: Meal) => (
    <View key={meal.id} style={styles.mealRow}>
      <View>
        <Text style={styles.mealName}>{meal.name}</Text>
        <Text style={styles.mealMeta}>
          {meal.time} • {meal.calories} cal
        </Text>
      </View>
    </View>
  );

  const renderTaskRow = (task: Task) => (
    <View key={task.id} style={styles.taskRow}>
      <View style={[styles.checkbox, task.done && styles.checkboxChecked]}>
        {task.done ? <Text style={styles.checkboxIcon}>✓</Text> : null}
      </View>
      <Text style={[styles.taskText, task.done && styles.taskDone]}>{task.title}</Text>
    </View>
  );

  const renderTodayView = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Today’s Eating</Text>
        <Text style={styles.sectionSubheading}>Total {todayData.calories} cal • P {todayData.macros.protein}g • C {todayData.macros.carbs}g • F {todayData.macros.fat}g</Text>
        {todayData.meals.map(renderMealRow)}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Today’s Tasks</Text>
        <Text style={styles.sectionSubheading}>Meal prep, cleaning, shopping, and more</Text>
        {todayData.tasks.map(renderTaskRow)}
      </View>
    </>
  );

  const renderMultiDayCard = ({ item }: { item: DaySnapshot }) => {
    const dateObj = new Date(item.date);
    return (
      <View style={styles.dayCard}>
        <Text style={styles.dayCardDate}>{formatDate(dateObj)}</Text>
        <Text style={styles.dayCardSummary}>
          {item.meals.length} meals · {item.tasks.length} tasks
        </Text>
        <View style={styles.dayCardDivider} />
        <View>
          <Text style={styles.cardSectionLabel}>Meals</Text>
          {item.meals.slice(0, 3).map((meal) => (
            <Text key={meal.id} style={styles.cardListItem}>
              {meal.name} · {meal.time}
            </Text>
          ))}
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={styles.cardSectionLabel}>Tasks</Text>
          {item.tasks.slice(0, 3).map((task) => (
            <Text key={task.id} style={styles.cardListItem}>
              {task.title}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const dayHasData = (day: number | null) => {
    if (!day) return false;
    const iso = toISODate(new Date(now.getFullYear(), now.getMonth(), day));
    return dailySnapshots.some((snapshot) => snapshot.date === iso);
  };

  const renderMonthView = () => (
    <View style={styles.monthContainer}>
      <View style={styles.monthHeader}>
        <Text style={styles.sectionHeading}>
          {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
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
        {monthDays.map((day, index) => {
          const isSelected = day && selectedMonthDay === day;
          return (
            <TouchableOpacity
              key={`${day ?? "empty"}-${index}`}
              style={[
                styles.gridCell,
                day ? styles.gridCellActive : styles.gridCellEmpty,
                isSelected && styles.gridCellSelected,
              ]}
              activeOpacity={0.8}
              disabled={!day}
              onPress={() => setSelectedMonthDay(day ?? null)}
            >
              {day ? <Text style={styles.gridCellText}>{day}</Text> : null}
              {dayHasData(day) ? <View style={styles.gridDot} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedMonthDay && selectedDayData ? (
        <View style={[styles.section, styles.monthDetail]}>
          <Text style={styles.sectionHeading}>{formatDate(new Date(selectedDayData.date))}</Text>
          <Text style={styles.sectionSubheading}>
            {selectedDayData.meals.length} meals · {selectedDayData.tasks.length} tasks
          </Text>
          <View style={{ marginTop: 12 }}>
            <Text style={styles.cardSectionLabel}>Meals</Text>
            {selectedDayData.meals.map((meal) => (
              <Text key={meal.id} style={styles.cardListItem}>
                {meal.name} · {meal.time}
              </Text>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            <Text style={styles.cardSectionLabel}>Tasks</Text>
            {selectedDayData.tasks.map((task) => (
              <Text key={task.id} style={styles.cardListItem}>
                {task.title}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
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

        {range === "1d" ? (
          renderTodayView()
        ) : range === "Month" ? (
          renderMonthView()
        ) : (
          <FlatList
            data={multiDayData}
            keyExtractor={(item) => item.date}
            renderItem={renderMultiDayCard}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 16 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20,
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
    padding: 4,
    justifyContent: "space-between",
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0a101b",
    padding: 20,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  sectionSubheading: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  mealRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
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
  dayCardSummary: {
    fontSize: 13,
    marginTop: 4,
    color: "rgba(255,255,255,0.6)",
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
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },
  gridCell: {
    width: `${100 / 7}%`,
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
