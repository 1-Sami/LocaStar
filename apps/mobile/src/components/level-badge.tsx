import type { LevelState } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const AMBER = '#E8A93B';

/**
 * Somebody's level, as one small pill.
 *
 * A name and a medal, never a number. The points belong on the Achievements
 * screen, where they sit next to what earned them; beside a review they would
 * be a score with nothing to compare it to except the score above it, which is
 * the ranking this design does not have.
 *
 * Renders nothing at level 1. A badge that reads "Newcomer" on every new
 * account is noise on every review, and the first rung is only 50 points away —
 * arriving at "Contributor" means more when it is the first badge to appear
 * than when it is the second to change.
 */
export function LevelBadge({ level, size = 'small' }: { level: LevelState | null; size?: 'small' | 'large' }) {
  const { t } = useTranslation();
  if (!level || level.number <= 1) return null;
  const large = size === 'large';
  return (
    <View style={[styles.pill, large && styles.pillLarge]}>
      <Ionicons name="medal" size={large ? 13 : 11} color={AMBER} />
      <ThemedText type="small" style={[styles.label, large && styles.labelLarge]} numberOfLines={1}>
        {t(`achievements.level.${level.id}`)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${AMBER}66`,
    backgroundColor: `${AMBER}1F`,
  },
  pillLarge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    gap: 5,
  },
  label: {
    color: AMBER,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  labelLarge: {
    fontSize: 12.5,
    lineHeight: 17,
  },
});
