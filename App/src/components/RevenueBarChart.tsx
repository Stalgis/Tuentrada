import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  useWindowDimensions,
} from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { CurveType } from "gifted-charts-core";

import { mockDailySalesSummaries } from "../data/mockEventAnalytics";
import { useAppState } from "../store/appState";

interface Props {
  period: "7d" | "30d";
  eventId: string;
}

interface DailyValue {
  date: string; // ISO date string
  label: string; // day of month (e.g. "17")
  value: number;
  formatted: string; // "$1.234"
  fullLabel: string; // "17/12"
}

export const RevenueBarChart = ({ period, eventId }: Props) => {
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const { width: windowWidth } = useWindowDimensions();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const screenWidth = windowWidth;
  const chartWidth = Math.max(220, windowWidth - 32);
  const barWidth = 28;
  const barSpacing = 16;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const dailyData: DailyValue[] = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    const periodKey = period === "7d" ? "last7Days" : "last30Days";

    const matched = mockDailySalesSummaries.find(
      (s) => s.eventId === eventId && s.period === periodKey
    );
    if (!matched) return [];

    for (const d of matched.days) {
      revenueMap[d.date] = (revenueMap[d.date] || 0) + d.revenueARS;
    }

    const sortedDates = Object.keys(revenueMap).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    return sortedDates.map((dateStr) => {
      const dateObj = new Date(dateStr);
      const dd = String(dateObj.getDate()).padStart(2, "0");
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");

      const value = revenueMap[dateStr];
      return {
        date: dateStr,
        label: dateObj.getDate().toString(),
        fullLabel: `${dd}/${mm}`,
        value,
        formatted: `$${value.toLocaleString("es-AR")}`,
      };
    });
  }, [period, eventId]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setSelectedIndex(null);
    opacityAnim.setValue(0);
  }, [eventId, period, dailyData.length, opacityAnim]);

  const maxValue = useMemo(() => {
    if (!dailyData.length) return 0;
    const m = Math.max(...dailyData.map((d) => d.value));
    return m * 1.2;
  }, [dailyData]);

  const barChartData = useMemo(() => {
    const baseColor = isDark ? "#5aa2ff" : "#007bff";
    const selectedColor = isDark ? "#93c5fd" : "#5a8dff";
    const gradientColor = isDark ? "#93c5fd" : "#64b0ff";

    return dailyData.map((item, index) => ({
      value: item.value,
      label: item.label,
      frontColor: selectedIndex === index ? selectedColor : baseColor,
      gradientColor,
      barBorderRadius: 12,
      onPress: () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setSelectedIndex(index);
        opacityAnim.setValue(1);

        timeoutRef.current = setTimeout(() => {
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => setSelectedIndex(null));
        }, 3000);
      },
    }));
  }, [dailyData, selectedIndex, isDark, opacityAnim]);

  const barInitialSpacing = useMemo(() => {
    const count = barChartData.length;
    if (count === 0) return 16;
    const totalWidth = count * barWidth + Math.max(count - 1, 0) * barSpacing;
    const freeSpace = chartWidth - totalWidth;
    return Math.max(16, freeSpace / 2);
  }, [barChartData.length, chartWidth]);

  const tooltipLeft = useMemo(() => {
    if (selectedIndex === null) return 0;
    const baseLeft =
      barInitialSpacing + selectedIndex * (barWidth + barSpacing);
    const tooltipWidth = 120;

    if (baseLeft + tooltipWidth > chartWidth - 16) {
      return chartWidth - tooltipWidth - 16;
    }
    return baseLeft;
  }, [selectedIndex, chartWidth, barInitialSpacing]);

  const lineChartData = useMemo(() => {
    return dailyData.map((item, index) => ({
      value: item.value,
      label: index % 5 === 0 ? item.label : "",
      date: item.date,
      fullLabel: item.fullLabel,
      formatted: item.formatted,
    }));
  }, [dailyData]);

  const lineColor = isDark ? "#5aa2ff" : "#007bff";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipSub = isDark ? "#94a3b8" : "#666";
  const selectedDay =
    selectedIndex !== null && dailyData[selectedIndex]
      ? dailyData[selectedIndex]
      : null;

  return (
    <View style={{ paddingTop: 22 }}>
      {period === "7d" ? (
        <>
          <BarChart
            key={`${eventId}-${period}`}
            data={barChartData}
            width={chartWidth}
            barWidth={barWidth}
            spacing={barSpacing}
            roundedTop
            noOfSections={4}
            yAxisThickness={0}
            xAxisThickness={0}
            hideRules
            hideYAxisText
            initialSpacing={barInitialSpacing}
            maxValue={maxValue}
            isAnimated
            showFractionalValues={false}
            xAxisLabelTextStyle={{
              color: isDark ? "#94a3b8" : "#475569",
              fontSize: 12,
            }}
          />

          {selectedDay && (
            <Animated.View
              style={[
                styles.tooltip,
                {
                  left: tooltipLeft,
                  opacity: opacityAnim,
                  backgroundColor: tooltipBg,
                  shadowColor: "#000",
                },
              ]}
            >
              <Text style={[styles.tooltipDate, { color: tooltipSub }]}>
                Día {selectedDay.label}
              </Text>
              <Text style={[styles.tooltipValue, { color: lineColor }]}>
                {selectedDay.formatted}
              </Text>
              <View
                style={[styles.tooltipArrow, { borderTopColor: tooltipBg }]}
              />
            </Animated.View>
          )}
        </>
      ) : (
        <LineChart
          key={`${eventId}-${period}`}
          data={lineChartData}
          width={chartWidth}
          height={200}
          labelsExtraHeight={32}
          xAxisLabelsHeight={28}
          isAnimated
          animationDuration={650}
          thickness={3}
          dataPointsColor={isDark ? "#93c5fd" : "#007bff"}
          color={lineColor}
          maxValue={maxValue}
          noOfSections={4}
          yAxisThickness={0}
          xAxisThickness={0}
          hideRules
          hideYAxisText
          curved
          curveType={CurveType.CUBIC}
          curvature={0.2}
          adjustToWidth
          disableScroll
          initialSpacing={0}
          pointerConfig={{
            pointerStripUptoDataPoint: true,
            pointerStripColor: isDark ? "#334155" : "#e2e8f0",
            pointerStripWidth: 2,
            radius: 4,

            persistPointer: true,
            autoAdjustPointerLabelPosition: true,
            activatePointersOnLongPress: false,

            // Importante: que el tamaño declarado coincida con el tooltip real
            pointerLabelWidth: 140,
            pointerLabelHeight: 60,

            // Importante: NO usar absolute / top / left acá
            pointerLabelComponent: (items: any[]) => {
              const it = items?.[0];
              if (!it) return null;

              return (
                <View
                  style={{
                    width: 140,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: tooltipBg,
                    borderRadius: 10,
                    elevation: 6,
                    shadowColor: "#000",
                    shadowOpacity: 0.18,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                  }}
                >
                  <Text style={{ fontSize: 12, color: tooltipSub }}>
                    Día {it.fullLabel}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: lineColor,
                    }}
                  >
                    {it.formatted}
                  </Text>
                </View>
              );
            },
          }}
          xAxisLabelTextStyle={{
            color: isDark ? "#94a3b8" : "#475569",
            fontSize: 10,
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tooltip: {
    position: "absolute",
    top: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tooltipDate: {
    fontSize: 12,
  },
  tooltipValue: {
    fontWeight: "600",
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
});
