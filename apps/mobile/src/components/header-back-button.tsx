import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A stand-in for the stack's own back arrow, for screens that need to ask
 * something before they let you leave.
 *
 * Matches the platform arrow so replacing it is invisible: a chevron on iOS,
 * the arrow on Android.
 */
export function HeaderBackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.button} accessibilityLabel={t('components.goBack')}>
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={24}
        color={theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingRight: Spacing.three,
  },
});
