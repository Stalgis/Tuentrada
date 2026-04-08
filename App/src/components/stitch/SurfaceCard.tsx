import React from "react";
import { View, type ViewProps } from "react-native";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";

type SurfaceCardProps = ViewProps & {
  tone?: "base" | "muted" | "hero";
  padded?: boolean;
};

const SurfaceCard = ({
  tone = "base",
  padded = true,
  style,
  children,
  ...rest
}: SurfaceCardProps) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);

  const backgroundColor =
    tone === "hero"
      ? palette.surfaceEmphasis
      : tone === "muted"
        ? palette.surfaceMuted
        : palette.surface;

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: 28,
          padding: padded ? 18 : 0,
          borderWidth: 1,
          borderColor: palette.hairline,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};

export default SurfaceCard;
