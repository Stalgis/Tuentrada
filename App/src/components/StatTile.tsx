import React from 'react';
import { Text, View } from 'react-native';

type StatTileProps = {
  label: string;
  value: string | number;
  accent?: string;
  size?: 'md' | 'sm';
  className?: string;
};

const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  accent = '#007bff',
  size = 'md',
  className = '',
}) => {
  const isSmall = size === 'sm';
  const paddingClass = isSmall ? 'p-3' : 'p-4';
  const shadowClass = isSmall ? '' : 'shadow-card';
  const labelClass = isSmall
    ? 'text-[10px] uppercase tracking-wide text-subtext-light dark:text-subtext-dark'
    : 'text-xs uppercase tracking-wide text-subtext-light dark:text-subtext-dark';
  const valueClass = isSmall
    ? 'mt-1 text-lg font-semibold text-text-light dark:text-text-dark'
    : 'mt-2 text-2xl font-semibold text-text-light dark:text-text-dark';

  return (
    <View
      className={`rounded-2xl bg-card-light ${paddingClass} ${shadowClass} dark:bg-card-dark ${className}`}
    >
      <Text className={labelClass}>{label}</Text>
      <Text className={valueClass} style={{ color: accent }}>
        {value}
      </Text>
    </View>
  );
};

export default StatTile;
