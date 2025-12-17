import React from 'react';
import { Text, View } from 'react-native';

type StatTileProps = {
  label: string;
  value: string | number;
  accent?: string;
  className?: string;
};

const StatTile: React.FC<StatTileProps> = ({ label, value, accent = '#0f5cff', className = '' }) => (
  <View className={`rounded-2xl bg-card-light p-4 shadow-card dark:bg-card-dark ${className}`}>
    <Text className="text-xs uppercase tracking-wide text-subtext-light dark:text-subtext-dark">{label}</Text>
    <Text className="mt-2 text-2xl font-semibold text-text-light dark:text-text-dark" style={{ color: accent }}>
      {value}
    </Text>
  </View>
);

export default StatTile;
