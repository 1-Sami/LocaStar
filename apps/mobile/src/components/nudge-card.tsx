import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TappedNudge } from '@/lib/use-notification-taps';

/**
 * The tapped nudge, shown in the app until it is closed.
 *
 * A banner on the lock screen is gone the moment it is glanced past, and the
 * fifteen-day campaign is fifteen small asks — being told to do something you
 * never read is worse than not being told. Tapping now brings the sentence with
 * it, and it stays until it is dismissed.
 *
 * An absolutely positioned overlay rather than a Modal, and deliberately: iOS
 * will not present a second Modal while one is up — it lands behind the first,
 * invisible and impossible to close, which this app has been bitten by twice
 * already. A tap can arrive while a photo viewer or a report sheet is open, and
 * an overlay in that case simply waits underneath and appears when the sheet
 * closes, which is a far better failure than a card nobody can dismiss.
 *
 * The scrim swallows touches without closing on them: the owner's whole point
 * is that it has to be read and shut deliberately, not swiped past like the
 * banner it replaces. Android's back button does close it, because a back press
 * that instead navigated the screen underneath — leaving the card floating over
 * a different page — would be worse than either.
 */
export function NudgeCard({ nudge, onClose }: { nudge: TappedNudge | null; onClose: () => void }) {
  const { t } = useTranslation();
  const open = Boolean(nudge);

  useEffect(() => {
    if (!open || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);

  if (!nudge) return null;

  return (
    <View style={styles.scrim}>
      {/* Catches every touch that misses the card, so the app underneath
          cannot be poked at while this is up. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

      <LinearGradient
        colors={['#7C4DE8', '#2BA36B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Pressable
          style={styles.close}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={18} color="#ffffff" />
        </Pressable>

        <ThemedText style={styles.title}>{nudge.title}</ThemedText>
        {Boolean(nudge.body) && <ThemedText style={styles.body}>{nudge.body}</ThemedText>}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    // Both, because Android orders overlapping siblings by elevation and iOS
    // by zIndex, and this has to sit above the tab bar on each.
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  close: {
    position: 'absolute',
    top: -14,
    right: -10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#8E1B2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
});
