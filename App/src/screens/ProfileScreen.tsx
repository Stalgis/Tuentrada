import React from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, ToastAndroid, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import Chip from '../components/UI/Chip';
import Button from '../components/UI/Button';
import Section from '../components/UI/Section';
import { useAppState } from '../store/appState';
import { useAuth } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import PageHeader from '../components/UI/PageHeader';
import { AppStackParamList } from '../navigation/types';

const languageOptions: { value: 'en' | 'es'; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
];

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
};

const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user, biometricEnabled, enableBiometric, disableBiometric, logout } = useAuth();
  const {
    language,
    setLanguage,
    clearEventsCache,
    themePreference,
    setTheme,
    theme,
  } = useAppState();
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const iconColor = isDark ? '#e2e8f0' : '#0f172a';
  const backgroundClass = isDark ? 'bg-background-dark' : 'bg-background-light';
  const textClass = isDark ? 'text-text-dark' : 'text-text-light';
  const subtextClass = isDark ? 'text-subtext-dark' : 'text-subtext-light';
  const cardClass = `rounded-3xl p-5 shadow-card border ${
    isDark ? 'bg-card-dark border-border-dark' : 'bg-card-light border-border-light'
  }`;
  const panelClass = `rounded-2xl border p-4 ${
    isDark ? 'border-border-dark bg-card-dark' : 'border-border-light bg-card-light'
  }`;

  const handleSignOut = () => {
    showToast(t('signOutToast'));
    logout();
  };

  const handleClearCache = () => {
    clearEventsCache();
    showToast(t('clearCacheToast'));
  };

  return (
    <SafeAreaView className={`flex-1 ${backgroundClass}`}>
      <PageHeader
        title="Perfil"
        leftAccessory={
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            className="rounded-full bg-card-light p-2 border border-border-light dark:bg-card-dark dark:border-border-dark"
          >
            <Feather name="arrow-left" size={20} color={iconColor} />
          </Pressable>
        }
      />
      <ScrollView className="flex-1 px-5 pt-4" contentInsetAdjustmentBehavior="automatic">
        <View className={`mb-6 flex-row items-center ${cardClass}`}>
          <Avatar initials={user?.initials ?? 'TU'} size="lg" />
          <View className="ml-4">
            <Text className={`text-lg font-semibold ${textClass}`}>
              {user?.name ?? 'Promoter'}
            </Text>
            <Text className={subtextClass}>{user?.email}</Text>
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

        <Section title="Apariencia">
          <Text className={`text-base ${subtextClass}`}>Elegi entre modo claro, oscuro o seguir el esquema del dispositivo.</Text>
          <View className="mt-3 flex-row gap-3">
            <Chip
              label="Sistema"
              selected={themePreference === 'system'}
              onPress={() => setTheme('system')}
              accessibilityLabel="Usar tema segun el dispositivo"
            />
            <Chip
              label="Light"
              selected={themePreference === 'light'}
              onPress={() => setTheme('light')}
              accessibilityLabel="Cambiar a modo claro"
            />
            <Chip
              label="Dark"
              selected={themePreference === 'dark'}
              onPress={() => setTheme('dark')}
              accessibilityLabel="Cambiar a modo oscuro"
            />
          </View>
        </Section>

        <Section title={t('securityTitle')}>
          <Text className={`text-base ${subtextClass}`}>{t('securityBody')}</Text>
          <View className={`mt-4 ${panelClass}`}>
            <Text className={`text-sm font-semibold ${textClass}`}>
              {biometricEnabled ? t('faceIdStatusEnabled') : t('faceIdStatusDisabled')}
            </Text>
            <Text className={`mt-1 text-xs ${subtextClass}`}>
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
          <Text className={`text-base ${subtextClass}`}>{t('aboutBody')}</Text>
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
