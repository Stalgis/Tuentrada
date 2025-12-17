import React from 'react';
import { Text, View, ViewProps } from 'react-native';

type SectionProps = ViewProps & {
  title: string;
  action?: React.ReactNode;
  className?: string;
};

const Section: React.FC<SectionProps> = ({ title, action, children, className = '', ...rest }) => (
  <View className={`mb-6 ${className}`} {...rest}>
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-base font-semibold text-text-light dark:text-text-dark">{title}</Text>
      {action}
    </View>
    <View className="rounded-2xl bg-card-light p-4 shadow-card dark:bg-card-dark">{children}</View>
  </View>
);

export default Section;
