import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, TextInput } from 'react-native';

import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { writeFailureMessage } from '@/lib/restriction';

/*
 * The `value` is what gets stored on the report and read by moderators; the
 * label is only ever displayed. Translating the stored value would mean a
 * Swedish reporter files "Skräppost" and an English one files "Spam" for the
 * same thing, leaving the moderation queue in two languages and any future
 * grouping by reason broken.
 */
const REASON_OTHER = 'Other';

const LOCATION_REASONS: { value: string; labelKey: string }[] = [
  { value: 'Spam', labelKey: 'components.reasonSpam' },
  { value: 'Inappropriate content', labelKey: 'components.reasonInappropriate' },
  { value: "Doesn't exist / permanently closed", labelKey: 'components.reasonClosed' },
  { value: 'Incorrect information', labelKey: 'components.reasonIncorrect' },
  { value: 'Duplicate of another listing', labelKey: 'components.reasonDuplicate' },
  { value: REASON_OTHER, labelKey: 'components.reasonOther' },
];

/*
 * A review has fewer honest complaints available than a listing does.
 *
 * "Doesn't exist", "Incorrect information" and "Duplicate" are all claims
 * about a place, not about somebody's opinion of it — offering them here
 * invited reports that a moderator can only dismiss, because disagreeing with
 * a review is not a rule violation.
 */
const REVIEW_REASONS: { value: string; labelKey: string }[] = [
  { value: 'Spam', labelKey: 'components.reasonSpam' },
  { value: 'Inappropriate content', labelKey: 'components.reasonInappropriate' },
  { value: REASON_OTHER, labelKey: 'components.reasonOther' },
];

/** Words, not characters: "bad" and "no" are not a reason anyone can act on. */
const MIN_OTHER_WORDS = 3;

function countWords(text: string): number {
  return text.trim().split(/s+/).filter(Boolean).length;
}

export function ReportModal({
  visible,
  title,
  confirmationText,
  target = 'location',
  children,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  confirmationText: string;
  /** Which reasons to offer. A review has fewer — see REVIEW_REASONS. */
  target?: 'location' | 'review';
  /** Shown above the reasons: what is being reported, so it can be judged here. */
  children?: ReactNode;
  onClose: () => void;
  onSubmit: (reason: string, details: string | null) => Promise<void>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useAuth();
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

  /*
   * Picking a reason is enough, except for "Other".
   *
   * Every other option already says what the complaint is; demanding a
   * written explanation on top of it only taught people to type "." to get
   * past the button. "Other" says nothing on its own, so it is the one case
   * where the box is the whole report — and three words is the floor at
   * which it starts being something a moderator can act on.
   */
  const reasons = target === 'review' ? REVIEW_REASONS : LOCATION_REASONS;
  const needsExplanation = reason === REASON_OTHER;
  const isValid = Boolean(reason) && (!needsExplanation || countWords(details) >= MIN_OTHER_WORDS);

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason as string, details.trim() || null);
      setSubmitted(true);
    } catch {
      setError(
        await writeFailureMessage(
          session?.user.id,
          t('validation.reportFailed'),
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
                {t('components.reportThanks')}
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {confirmationText}
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
                {title}
              </ThemedText>
              {children}
              {reasons.map((r) => (
                <Pressable key={r.value} style={styles.modalRow} onPress={() => setReason(r.value)}>
                  <ThemedText type="default">{t(r.labelKey)}</ThemedText>
                  <ThemedText type="default">{reason === r.value ? '✓' : ''}</ThemedText>
                </Pressable>
              ))}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={t(needsExplanation ? 'components.reportPlaceholderOther' : 'components.reportPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                multiline
              />
              {needsExplanation && countWords(details) < MIN_OTHER_WORDS && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('components.reportOtherNeedsWords', { count: MIN_OTHER_WORDS })}
                </ThemedText>
              )}
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
                  {submitting ? t('components.submitting') : t('components.submitReport')}
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
