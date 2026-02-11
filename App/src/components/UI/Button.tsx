import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  Text,
} from 'react-native';

type ButtonVariant = 'primary' | 'ghost';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
};

const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  ...rest
}) => {
  const isDisabled = disabled || loading;
  const baseClasses = `flex-row items-center justify-center rounded-2xl px-5 py-3 transition-colors duration-300 ${
    variant === 'primary' ? 'shadow-card' : ''
  } ${isDisabled ? 'opacity-60' : ''} ${className}`;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={baseClasses}
      style={({ pressed, hovered }) => {
        const isActive = pressed || hovered;
        return {
          backgroundColor:
            variant === 'primary'
              ? isActive
                ? '#0066cc'
                : '#007bff'
              : isActive
                ? '#007bff'
                : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: '#007bff',
        };
      }}
      {...rest}
    >
      {({ pressed, hovered }) => {
        const isActive = pressed || hovered;
        const textColor =
          variant === 'primary' ? '#ffffff' : isActive ? '#ffffff' : '#0066cc';
        return loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Text className="font-medium text-base" style={{ color: textColor }}>
            {label}
          </Text>
        );
      }}
    </Pressable>
  );
};

export default Button;
