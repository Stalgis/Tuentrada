import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, Text } from 'react-native';

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
  const variantClasses =
    variant === 'primary'
      ? 'bg-primary-600'
      : 'bg-transparent border border-border';
  const textClasses = variant === 'primary' ? 'text-white' : 'text-primary-600';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-2xl px-5 py-3 ${variantClasses} ${
        isDisabled ? 'opacity-60' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#0f5cff'} />
      ) : (
        <Text className={`font-semibold text-base ${textClasses}`}>{label}</Text>
      )}
    </Pressable>
  );
};

export default Button;
