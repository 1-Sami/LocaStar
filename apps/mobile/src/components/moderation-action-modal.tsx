import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Confirmation for a moderation decision. Unlike a plain confirm dialog this
 * takes a written reason, which is required: it is shown to the person being
 * warned and stored on the report and in the moderation log, so "why" survives
 * beyond the moderator's memory.
 */
export function ModerationActionModal({
  visible,
  title,
  consequence,
  noteLabel,
  confirmLabel,
  destructive = false,
  submitting = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  consequence: string;
  noteLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [note, setNote] = useState('');

  // Each decision gets a fresh note because the parent remounts this with a
  // key per report, so useState above starts blank on its own. Clearing it
  // in an effect instead meant a render with the previous decision's text
  // still in the box.

  const canConfirm = note.trim().length > 0 && !submitting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <SheetRoot>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <ThemedView type="backgroundElement" style={styles.sheet}>
          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {consequence}
          </ThemedText>

          <ThemedText type="smallBold" style={styles.noteLabel}>
            {noteLabel}
          </ThemedText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('components.explainDecision')}
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel} disabled={submitting}>
              <ThemedText type="smallBold">{t('common.cancel')}</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
                !canConfirm && styles.buttonDisabled,
              ]}
              disabled={!canConfirm}
              onPress={() => onConfirm(note.trim())}>
              <ThemedText type="smallBold" style={styles.confirmButtonText}>
                {submitting ? t('components.working') : confirmLabel}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </SheetRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  noteLabel: {
    marginTop: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    height: 90,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  confirmButton: {
    backgroundColor: '#14747A',
  },
  destructiveButton: {
    backgroundColor: '#E05252',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#ffffff',
  },
});
