import type { ThemePreference } from '@locastar/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useThemeMode } from '@/lib/theme-mode-context';

const options: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match system' },
];

export default function ThemeScreen() {
  const { mode, setMode } = useThemeMode();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          {options.map((option) => (
            <Pressable key={option.value} onPress={() => setMode(option.value)}>
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedText type="default">{option.label}</ThemedText>
                <ThemedText type="default">{mode === option.value ? '✓' : ''}</ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </View>
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
});
