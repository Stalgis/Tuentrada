import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/UI/Button';
import { useAuth } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';

const LoginScreen = () => {
  const { login, loading } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('cliente@tuentrada.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError(t('loginMissingFields'));
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginGenericError'));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 px-5 pt-8" keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-semibold text-text">{t('loginTitle')}</Text>
        <Text className="mt-2 text-base text-subtext">{t('loginSubtitle')}</Text>

        <View className="mt-8">
          <Text className="mb-2 text-xs uppercase text-subtext">{t('emailLabel')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="cliente@tuentrada.com"
            className="rounded-2xl border border-border bg-white px-4 py-3 text-base text-text"
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase text-subtext">{t('passwordLabel')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            className="rounded-2xl border border-border bg-white px-4 py-3 text-base text-text"
          />
        </View>

        {error && <Text className="mt-3 text-sm text-rose-500">{error}</Text>}

        <Button label={t('loginButton')} className="mt-6" onPress={handleSubmit} loading={loading} />

        <View className="mt-8 rounded-2xl bg-white p-4 shadow-card">
          <Text className="text-sm font-semibold text-text">{t('tempCredentialsHintTitle')}</Text>
          <Text className="mt-1 text-sm text-subtext">{t('tempCredentialsHint')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
