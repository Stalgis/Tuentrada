import React from 'react';
import { Text, View } from 'react-native';

type StatTileProps = {
  label: string;
  value: string | number;
  accent?: string;
  className?: string;
};

const StatTile: React.FC<StatTileProps> = ({ label, value, accent = '#0f5cff', className = '' }) => (
  <View className={`rounded-2xl bg-white p-4 shadow-card ${className}`}>
    <Text className="text-xs uppercase tracking-wide text-subtext">{label}</Text>
    <Text className="mt-2 text-2xl font-semibold text-text" style={{ color: accent }}>
      {value}
    </Text>
  </View>
);

export default StatTile;
