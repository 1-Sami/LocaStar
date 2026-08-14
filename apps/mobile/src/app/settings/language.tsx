import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deviceLanguage,
  getLanguagePreference,
  setLanguagePreference,
  type LanguagePreference,
} from '@/lib/i18n';

const OPTIONS: LanguagePreference[] = ['system', 'sv', 'en'];

export default function LanguageScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [preference, setPreference] = useState<LanguagePreference | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getLanguagePreference().then((stored) => {
        if (!cancelled) setPreference(stored);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const choose = async (next: LanguagePreference) => {
    // Set immediately so the tick moves under the finger; the write is the slow
    // part and nothing depends on it having finished.
    setPreference(next);
    await setLanguagePreference(next);
  };

  if (preference === null) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ActivityIndicator style={styles.loading} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('language.description')}
          </ThemedText>

          {OPTIONS.map((option) => (
            <Pressable key={option} onPress={() => choose(option)}>
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedView type="backgroundElement" style={styles.rowText}>
                  <ThemedText type="default">
                    {option === 'system' ? t('language.system') : t(`language.${option}`)}
                  </ThemedText>
                  {option === 'system' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('language.systemDetail', { language: t(`language.${deviceLanguage()}`) })}
                    </ThemedText>
                  )}
                </ThemedView>
                {preference === option && (
                  <Ionicons name="checkmark" size={20} color={theme.text} />
                )}
              </ThemedView>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  loading: {
    marginTop: Spacing.six,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  rowText: {
    gap: 2,
  },
});
