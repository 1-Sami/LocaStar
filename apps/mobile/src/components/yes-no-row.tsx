import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A question with two answers and nothing pre-selected.
 *
 * Lived inside the add form until the edit form needed the same control for
 * public/private. A third answer matters here: `value` is null until somebody
 * has chosen, and neither box is ticked then — which is not the same as having
 * picked "no", and is what the create form uses to insist on an answer.
 *
 * The border comes from theme.fieldBorder rather than the stylesheet: it was
 * 60% white, which is a box on the dark theme and nothing at all on the light
 * one, where the page behind it is #ffffff.
 */
export function YesNoRow({
  label,
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText type="default">{label}</ThemedText>
      <View style={styles.options}>
        <Pressable
          style={styles.option}
          onPress={() => onChange(true)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: value === true }}>
          <ThemedText type="small">{yesLabel ?? t('common.yes')}</ThemedText>
          <View
            style={[styles.checkbox, { borderColor: theme.fieldBorder }, value === true && styles.checked]}
          />
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => onChange(false)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: value === false }}>
          <ThemedText type="small">{noLabel ?? t('common.no')}</ThemedText>
          <View
            style={[styles.checkbox, { borderColor: theme.fieldBorder }, value === false && styles.checked]}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    gap: Spacing.five,
  },
  option: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: Spacing.half,
  },
  checked: {
    backgroundColor: '#14747A',
    borderColor: '#14747A',
  },
});
