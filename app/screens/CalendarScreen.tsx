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

const RANGE_OPTIONS: RangeOption[] = ["1d", "5d", "7d", "14d", "Month"];

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

const toISODate = (date: Date) => date.toISOString().split("T")[0];

const RANGE_DAY_COUNT: Record<RangeOption, number> = {
  "1d": 0,
  "5d": 5,
  "7d": 7,
  "14d": 14,
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

export const CalendarScreen = () => {
  const [range, setRange] = useState<RangeOption>("1d");
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(null);
  const now = new Date();
  const monthCells = buildMonthCalendar(now);
  const monthWeeks = useMemo(() => chunkIntoWeeks(monthCells), [monthCells]);
  const multiDayData = useMemo(() => {
    const count = RANGE_DAY_COUNT[range];
    if (!count) return [];
    return getUpcomingDates(count);
  }, [range]);
  const renderTodayView = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Today’s Eating</Text>
        <Text style={styles.sectionSubheading}>No meal data yet</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Today’s Tasks</Text>
        <Text style={styles.sectionSubheading}>Meal prep, cleaning, shopping, and more</Text>
        <Text style={[styles.taskText, styles.taskDone]}>No tasks logged yet</Text>
      </View>
    </>
  );

  const renderMultiDayCard = ({ item }: { item: Date }) => {
    const dateObj = item;
    return (
      <View style={styles.dayCard}>
        <Text style={styles.dayCardDate}>{formatDate(dateObj)}</Text>
        <Text style={styles.dayCardSummary}>No entries yet</Text>
        <View style={styles.dayCardDivider} />
        <View>
          <Text style={styles.cardSectionLabel}>Meals</Text>
          <Text style={styles.cardListItem}>No meals recorded yet</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={styles.cardSectionLabel}>Tasks</Text>
          <Text style={styles.cardListItem}>No tasks recorded yet</Text>
        </View>
      </View>
    );
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
                  onPress={() => setSelectedMonthDate(cell)}
                >
                  {cell ? <Text style={styles.gridCellText}>{cell.getDate()}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {selectedMonthDate ? (
        <View style={[styles.section, styles.monthDetail]}>
          <Text style={styles.sectionHeading}>{formatDate(selectedMonthDate)}</Text>
          <Text style={styles.sectionSubheading}>No entries logged for this day yet.</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
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
            keyExtractor={(item) => toISODate(item)}
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
