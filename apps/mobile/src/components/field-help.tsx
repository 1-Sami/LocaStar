import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
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
export function FieldHelp({
  text,
  label,
  type = 'default',
  style,
}: {
  text: string;
  label: string;
  type?: ThemedTextProps['type'];
  style?: ThemedTextProps['style'];
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      {/*
       * The icon is part of the label's text run, not a separate column. It
       * used to sit at the far right of the row, where the owner missed it
       * themselves (2026-11-27); inline it follows the last word, wherever a
       * long question wraps. The whole label is the button, which also gives
       * a target far bigger than the glyph.
       */}
      <ThemedText
        type={type}
        style={style}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={t('common.whatIsThis')}>
        {label}
        {/* A no-break space, so the icon never wraps onto a line alone. */}
        {' '}
        <Ionicons
          name={open ? 'close-circle' : 'help-circle'}
          size={20}
          color={theme.primary}
        />
      </ThemedText>

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
  panel: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
});
