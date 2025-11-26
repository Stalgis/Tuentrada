import React from 'react';
import { Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  description: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => (
  <View className="items-center justify-center rounded-3xl border border-dashed border-border px-6 py-12">
    <Text className="text-lg font-semibold text-text">{title}</Text>
    <Text className="mt-2 text-center text-base text-subtext">{description}</Text>
  </View>
);

export default EmptyState;
