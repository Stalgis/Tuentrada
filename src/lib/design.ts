import type { TextStyle, ViewStyle } from "react-native";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography: Record<
  | "caption"
  | "micro"
  | "body"
  | "bodyStrong"
  | "label"
  | "value"
  | "title"
  | "heading"
  | "display"
  | "hero"
  | "numeric",
  TextStyle
> = {
  caption: { fontSize: 11, fontWeight: "600" },
  micro: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  body: { fontSize: 13, fontWeight: "400" },
  bodyStrong: { fontSize: 13, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700" },
  value: { fontSize: 15, fontWeight: "800" },
  title: { fontSize: 18, fontWeight: "800" },
  heading: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  display: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  hero: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  numeric: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
};

export const shadow: Record<"card" | "elevated", ViewStyle> = {
  card: {
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  elevated: {
    shadowColor: "#101828",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 8,
  },
};

export const layout = {
  screenPaddingX: spacing.lg,
  sectionGap: spacing.md + 2,
  touchTarget: 44,
} as const;
