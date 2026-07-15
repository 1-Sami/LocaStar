import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const REPORT_REASONS = [
  'Spam',
  'Inappropriate content',
  "Doesn't exist / permanently closed",
  'Incorrect information',
  'Other',
];

export function ReportModal({
  visible,
  title,
  confirmationText,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  confirmationText: string;
  onClose: () => void;
  onSubmit: (reason: string, details: string | null) => Promise<void>;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    onClose();
    setReason(null);
    setDetails('');
    setSubmitted(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason, details.trim() || null);
      setSubmitted(true);
    } catch {
      setError('Something went wrong submitting your report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <ThemedView type="backgroundElement" style={styles.modalContent}>
          {submitted ? (
            <>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Thanks for letting us know
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {confirmationText}
              </ThemedText>
              <Pressable style={styles.submitButton} onPress={handleClose}>
                <ThemedText type="smallBold" style={styles.submitButtonText}>
                  Done
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                {title}
              </ThemedText>
              {REPORT_REASONS.map((r) => (
                <Pressable key={r} style={styles.modalRow} onPress={() => setReason(r)}>
                  <ThemedText type="default">{r}</ThemedText>
                  <ThemedText type="default">{reason === r ? '✓' : ''}</ThemedText>
                </Pressable>
              ))}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Additional details (optional)"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                multiline
              />
              {error && (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}
              <Pressable
                style={[styles.submitButton, (!reason || submitting) && styles.submitButtonDisabled]}
                disabled={!reason || submitting}
                onPress={handleSubmit}>
                <ThemedText type="smallBold" style={styles.submitButtonText}>
                  {submitting ? 'Submitting…' : 'Submit report'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    height: 80,
    textAlignVertical: 'top',
    marginTop: Spacing.two,
  },
  errorText: {
    color: '#E05252',
  },
  submitButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
  },
});
