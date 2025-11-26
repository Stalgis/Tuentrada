import React from 'react';
import { Text, View, ViewProps } from 'react-native';

type AvatarProps = ViewProps & {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

const Avatar: React.FC<AvatarProps> = ({ initials, size = 'md', style, className = '', ...rest }) => {
  const dimension = sizeMap[size];
  return (
    <View
      className={`items-center justify-center rounded-full bg-primary-600 ${className}`}
      style={[{ width: dimension, height: dimension }, style]}
      {...rest}
    >
      <Text className="text-white font-semibold">{initials}</Text>
    </View>
  );
};

export default Avatar;
