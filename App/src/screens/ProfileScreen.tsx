import React from 'react';
import { Alert, Platform, ScrollView, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import Chip from '../components/UI/Chip';
import Button from '../components/UI/Button';
import Section from '../components/UI/Section';
import { useAppState } from '../store/appState';
import { useAuth } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';

const languageOptions: { value: 'en' | 'es'; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
];

const currencyOptions: { value: 'ARS' | 'USD' | 'EUR'; label: string }[] = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
};

const ProfileScreen = () => {
  const { user, biometricEnabled, enableBiometric, disableBiometric, logout } = useAuth();
  const { language, setLanguage, currency, setCurrency, clearEventsCache } = useAppState();
  const { t } = useTranslation();

  const handleSignOut = () => {
    showToast(t('signOutToast'));
    logout();
  };

  const handleClearCache = () => {
    clearEventsCache();
    showToast(t('clearCacheToast'));
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 px-5 pt-4" contentInsetAdjustmentBehavior="automatic">
      <Text className="mb-6 text-2xl font-semibold text-text">{t('profileTitle')}</Text>

      <View className="mb-6 flex-row items-center rounded-3xl bg-white p-5 shadow-card">
        <Avatar initials={user?.initials ?? 'TU'} size="lg" />
        <View className="ml-4">
          <Text className="text-lg font-semibold text-text">{user?.name ?? 'Promoter'}</Text>
          <Text className="text-subtext">{user?.email}</Text>
        </View>
      </View>

      <Section title={t('languageLabel')}>
        <View className="flex-row gap-3">
          {languageOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={language === option.value}
              onPress={() => setLanguage(option.value)}
              accessibilityLabel={`Switch language to ${option.label}`}
            />
          ))}
        </View>
      </Section>

      <Section title={t('currencyLabel')}>
        <View className="flex-row flex-wrap gap-3">
          {currencyOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={currency === option.value}
              onPress={() => setCurrency(option.value)}
              accessibilityLabel={`Switch currency to ${option.label}`}
            />
          ))}
        </View>
      </Section>

      <Section title={t('securityTitle')}>
        <Text className="text-base text-subtext">{t('securityBody')}</Text>
        <View className="mt-4 rounded-2xl border border-slate-200 p-4">
          <Text className="text-sm font-semibold text-text">
            {biometricEnabled ? t('faceIdStatusEnabled') : t('faceIdStatusDisabled')}
          </Text>
          <Text className="mt-1 text-xs text-subtext">
            {biometricEnabled ? t('faceIdDisableHint') : t('faceIdEnableHint')}
          </Text>
          <Button
            label={biometricEnabled ? t('faceIdDisable') : t('faceIdEnable')}
            variant="ghost"
            className="mt-3"
            onPress={biometricEnabled ? disableBiometric : enableBiometric}
          />
        </View>
      </Section>

      <Section title={t('aboutTitle')}>
        <Text className="text-base text-subtext">{t('aboutBody')}</Text>
        <View className="mt-4 flex-row gap-3">
          <Button label={t('clearCache')} variant="ghost" className="flex-1" onPress={handleClearCache} />
          <Button label={t('signOut')} className="flex-1" onPress={handleSignOut} />
        </View>
      </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
