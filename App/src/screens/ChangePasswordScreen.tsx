import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/UI/Button';
import { useAuth } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';

const ChangePasswordScreen = () => {
  const { changePassword, loading, logout, user } = useAuth();
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (newPassword.length < 8 || confirmPassword.length < 8) {
      setError(t('passwordRules'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    try {
      await changePassword(newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginGenericError'));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light px-5 pt-8 dark:bg-background-dark">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <Text className="text-sm uppercase text-primary-600">{user?.email}</Text>
        <Text className="mt-1 text-3xl font-semibold text-text-light dark:text-text-dark">
          {t('changePasswordTitle')}
        </Text>
        <Text className="mt-2 text-base text-subtext-light dark:text-subtext-dark">{t('changePasswordSubtitle')}</Text>

        <View className="mt-8">
          <Text className="mb-2 text-xs uppercase text-subtext-light dark:text-subtext-dark">
            {t('newPasswordLabel')}
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="••••••••"
            autoCapitalize="none"
            className="rounded-2xl border border-border-light bg-card-light px-4 py-3 text-base text-text-light dark:border-border-dark dark:bg-card-dark dark:text-text-dark"
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase text-subtext-light dark:text-subtext-dark">
            {t('confirmPasswordLabel')}
          </Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="••••••••"
            autoCapitalize="none"
            className="rounded-2xl border border-border-light bg-card-light px-4 py-3 text-base text-text-light dark:border-border-dark dark:bg-card-dark dark:text-text-dark"
          />
        </View>

        <Text className="mt-3 text-xs text-subtext-light dark:text-subtext-dark">{t('passwordRules')}</Text>
        {error && <Text className="mt-2 text-sm text-rose-500">{error}</Text>}

        <Button label={t('changePasswordButton')} className="mt-6" onPress={handleSubmit} loading={loading} />

        <Button label={t('signOut')} variant="ghost" className="mt-3" onPress={logout} disabled={loading} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChangePasswordScreen;
