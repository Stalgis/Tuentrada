import React from 'react';
import { Pressable, PressableProps, Text } from 'react-native';

type ChipProps = PressableProps & {
  label: string;
  selected?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  textClassName?: string;
  selectedColors?: {
    background?: string;
    border?: string;
    text?: string;
  };
};

const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  size = 'md',
  className = '',
  textClassName = '',
  selectedColors,
  ...rest
}) => {
  const baseSpacing = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm';
  const defaultColors = {
    background: 'transparent',
    border: '#007bff',
    text: '#007bff',
  };
  const filledColors = {
    background: '#007bff',
    border: '#007bff',
    text: '#ffffff',
    ...selectedColors,
  };
  return (
    <Pressable
      accessibilityRole="button"
      className={`rounded-full border transition-colors duration-300 ${className}`}
      style={({ pressed, hovered }) => {
        const isActive = pressed || hovered;
        const isFilled = selected || isActive;
        const colors = isFilled ? filledColors : defaultColors;
        return {
          backgroundColor: colors.background,
          borderColor: colors.border,
        };
      }}
      {...rest}
    >
      {({ pressed, hovered }) => {
        const isActive = pressed || hovered;
        const textColor =
          selected || isActive ? filledColors.text : defaultColors.text;
        return (
          <Text
            className={`font-medium text-center ${baseSpacing} ${textClassName}`}
            style={{ color: textColor }}
          >
            {label}
          </Text>
        );
      }}
    </Pressable>
  );
};

export default Chip;
