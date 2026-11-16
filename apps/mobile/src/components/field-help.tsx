import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A label with the explanation folded behind a question mark.
 *
 * The add form asks fourteen questions and explains six of them in a sentence
 * underneath, which is accurate and makes the page long enough that the submit
 * button is four scrolls from the first field. Folding the explanation away
 * keeps it one tap from the question it belongs to.
 *
 * **Not a Modal.** add-location and edit-location are both
 * `presentation: 'modal'`, and a second RN Modal opened while one is up lands
 * *behind* it on iOS — the panel would simply never appear. So this expands
 * in place, in the same tree, which also means it pushes the rest of the form
 * down rather than covering it. See the report-photo sheet for the other half
 * of that lesson.
 *
 * Fold mechanics, not consequences. Anything that warns somebody they are
 * about to lose something stays on the page: a sentence nobody opens is a
 * sentence nobody read, which is fine for "you can leave this blank" and not
 * fine for "this deletes the reviews".
 */
export function FieldHelp({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <View style={styles.labelSlot}>{children}</View>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={t('common.whatIsThis')}
          /* The icon is 18px; the row it sits in is not, so the target is
             padded out rather than the glyph grown. */
          hitSlop={10}
          style={[styles.button, { borderColor: theme.fieldBorder }]}>
          <Ionicons
            name={open ? 'close' : 'help'}
            size={13}
            color={theme.textSecondary}
          />
        </Pressable>
      </View>

      {open && (
        <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {text}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  /* The label takes the room and wraps; the button never shrinks. */
  labelSlot: { flex: 1 },
  button: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
});
