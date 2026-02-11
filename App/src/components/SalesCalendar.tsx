import React, { useMemo, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar, type MarkedDates } from "react-native-calendars";
import { type DateObject } from "react-native-calendars/src/types";
import type { DailySalesSummary } from "../data/mockEventAnalytics";
import { useAppState } from "../store/appState";

type SalesCalendarProps = {
  summary?: DailySalesSummary;
};

type DayEntry = {
  ticketsSold: number;
  invitations: number;
  revenueARS: number;
};

const themeTokens = {
  light: {
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    subtext: "#475569",
    border: "#e2e8f0",
    accent: "#007bff",
  },
  dark: {
    background: "#020617",
    surface: "#0b1220",
    text: "#e2e8f0",
    subtext: "#94a3b8",
    border: "#1e293b",
    accent: "#60a5fa",
  },
} as const;

const SalesCalendar: React.FC<SalesCalendarProps> = ({ summary }) => {
  const { theme } = useAppState();
  const palette = themeTokens[theme];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const isDark = theme === "dark";

  const salesByDate = useMemo<Record<string, DayEntry>>(() => {
    const map: Record<string, DayEntry> = {};
    if (!summary) {
      return map;
    }
    summary.days.forEach((day) => {
      map[day.date] = {
        ticketsSold: day.ticketsSold,
        invitations: day.invitations,
        revenueARS: day.revenueARS,
      };
    });
    return map;
  }, [summary]);

  const markedDates = useMemo<MarkedDates>(() => {
    const marks: MarkedDates = {};
    Object.entries(salesByDate).forEach(([date, data]) => {
      const { ticketsSold } = data;
      const bgColor =
        ticketsSold >= 50
          ? "#22c55e"
          : ticketsSold >= 30
          ? "#eab308"
          : "#ef4444";
      marks[date] = {
        customStyles: {
          container: {
            backgroundColor: bgColor,
            borderRadius: 12,
          },
          text: {
            color: "#ffffff",
            fontWeight: "700",
          },
        },
      };
    });
    return marks;
  }, [salesByDate]);

  const handleDayPress = (day: DateObject) => {
    if (salesByDate[day.dateString]) {
      setSelectedDate(day.dateString);
      setModalVisible(true);
    } else {
      setSelectedDate(null);
    }
  };

  const selectedEntry = selectedDate ? salesByDate[selectedDate] : undefined;

  return (
    <View
      className={`rounded-2xl shadow-card ${
        isDark ? "bg-card-dark" : "bg-card-light"
      }`}
    >
      <Calendar
        key={theme}
        markingType="custom"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        theme={{
          calendarBackground: palette.surface,
          dayTextColor: palette.text,
          monthTextColor: palette.text,
          textDisabledColor: palette.subtext,
          arrowColor: palette.accent,
          todayTextColor: palette.accent,
          textMonthFontWeight: "700",
          textDayFontWeight: "600",
        }}
        style={styles.calendar}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: palette.background,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              {selectedDate ? `Detalle ${selectedDate}` : "Detalle"}
            </Text>

            {selectedEntry ? (
              <View>
                <Text style={[styles.detail, { color: palette.text }]}>
                  Tickets: {selectedEntry.ticketsSold.toLocaleString()}
                </Text>
                <Text style={[styles.detail, { color: palette.text }]}>
                  Invitaciones: {selectedEntry.invitations.toLocaleString()}
                </Text>
                <Text style={[styles.detail, { color: palette.text }]}>
                  Ingresos:{" "}
                  {selectedEntry.revenueARS.toLocaleString("es-AR", {
                    style: "currency",
                    currency: "ARS",
                  })}
                </Text>
              </View>
            ) : (
              <Text style={{ color: palette.subtext }}>
                No hay datos para esta fecha.
              </Text>
            )}

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={[
                styles.closeButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={{ color: palette.text, fontWeight: "600" }}>
                Cerrar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  calendar: {
    borderRadius: 13,
    overflow: "hidden",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  detail: {
    fontSize: 15,
    marginBottom: 6,
  },
  closeButton: {
    marginTop: 12,
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});

export default SalesCalendar;
