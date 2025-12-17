import React from 'react';
import { Pressable, PressableProps, Text } from 'react-native';

type ChipProps = PressableProps & {
  label: string;
  selected?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  textClassName?: string;
};

const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  size = 'md',
  className = '',
  textClassName = '',
  ...rest
}) => {
  const baseSpacing = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <Pressable
      accessibilityRole="button"
      className={`rounded-full border ${
        selected
          ? 'bg-primary-50 border-primary-400'
          : 'border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark'
      } ${className}`}
      {...rest}
    >
      <Text
        className={`font-medium text-center ${baseSpacing} ${
          selected ? 'text-primary-700' : 'text-subtext-light dark:text-subtext-dark'
        } ${textClassName}`}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export default Chip;
