import React from 'react';
import { Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  description: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => (
  <View className="items-center justify-center rounded-3xl border border-dashed border-border-light px-6 py-12 dark:border-border-dark">
    <Text className="text-lg font-semibold text-text-light dark:text-text-dark">{title}</Text>
    <Text className="mt-2 text-center text-base text-subtext-light dark:text-subtext-dark">{description}</Text>
  </View>
);

export default EmptyState;
