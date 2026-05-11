import React from 'react';
import { Pressable, Text, View, ViewProps } from 'react-native';

type AvatarProps = ViewProps & {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  textClassName?: string;
  onPress?: () => void;
};

const sizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

const Avatar: React.FC<AvatarProps> = ({
  initials,
  size = 'md',
  style,
  className = '',
  textClassName = '',
  onPress,
  ...rest
}) => {
  const dimension = sizeMap[size];
  const content = (
    <Text className={`font-semibold ${textClassName || "text-white"}`}>
      {initials}
    </Text>
  );
  const commonProps = {
    className: `items-center justify-center rounded-full bg-primary-600 ${className}`,
    style: [{ width: dimension, height: dimension }, style],
    ...rest,
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} {...commonProps}>
        {content}
      </Pressable>
    );
  }

  return (
    <View {...commonProps}>
      {content}
    </View>
  );
};

export default Avatar;
