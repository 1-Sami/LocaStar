import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

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
  const theme = useTheme();
  const [note, setNote] = useState('');

  // Start each decision from a blank note rather than the previous one's.
  useEffect(() => {
    if (visible) setNote('');
  }, [visible]);

  const canConfirm = note.trim().length > 0 && !submitting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
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
            placeholder="Explain the decision"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel} disabled={submitting}>
              <ThemedText type="smallBold">Cancel</ThemedText>
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
                {submitting ? 'Working…' : confirmLabel}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
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
