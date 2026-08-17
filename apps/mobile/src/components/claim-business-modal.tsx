import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, TextInput } from 'react-native';

import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { writeFailureMessage } from '@/lib/restriction';

const MIN_REASON_WORDS = 10;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function ClaimBusinessModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (verificationNotes: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useAuth();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesWordCount = wordCount(notes);
  const isValid = notesWordCount >= MIN_REASON_WORDS;

  const handleClose = () => {
    onClose();
    setNotes('');
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(notes.trim());
      setSubmitted(true);
    } catch {
      setError(
        await writeFailureMessage(
          session?.user.id,
          t('validation.claimFailed'),
          t
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <SheetRoot>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <ThemedView type="backgroundElement" style={styles.modalContent}>
          {submitted ? (
            <>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                {t('components.claimSubmitted')}
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {t('components.claimSubmittedBody')}
              </ThemedText>
              <Pressable style={styles.submitButton} onPress={handleClose}>
                <ThemedText type="smallBold" style={styles.submitButtonText}>
                  {t('form.done')}
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                {t('components.claimTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Tell us how you&apos;re connected to this business (e.g. your role, phone number, or
                website) so we can verify your claim. At least {MIN_REASON_WORDS} words required.
              </ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('components.verificationDetails')}
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                multiline
              />
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={isValid ? undefined : styles.wordCountWarning}>
                {notesWordCount} / {MIN_REASON_WORDS} words
              </ThemedText>
              {error && (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}
              <Pressable
                style={[styles.submitButton, (!isValid || submitting) && styles.submitButtonDisabled]}
                disabled={!isValid || submitting}
                onPress={handleSubmit}>
                <ThemedText type="smallBold" style={styles.submitButtonText}>
                  {submitting ? t('components.submitting') : t('components.submitClaim')}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </SheetRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    height: 90,
    textAlignVertical: 'top',
    marginTop: Spacing.two,
  },
  errorText: {
    color: '#E05252',
  },
  wordCountWarning: {
    color: '#E8A93B',
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
