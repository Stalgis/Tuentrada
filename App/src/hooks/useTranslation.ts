import { getTranslation, TranslationKey } from '../lib/i18n';
import { useAppState } from '../store/appState';

export const useTranslation = () => {
  const { language } = useAppState();
  const t = (key: TranslationKey) => getTranslation(language, key);
  return { t, language };
};
