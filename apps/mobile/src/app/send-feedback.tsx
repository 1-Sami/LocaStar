import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_LENGTH,
  FeedbackDailyLimitReached,
  submitFeedback,
  type FeedbackCategory,
  type FeedbackInput,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_RELEASE } from '@/constants/release';
import { SUPPORT_EMAIL } from '@/constants/support';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { writeFailureMessage } from '@/lib/restriction';
import { supabase } from '@/lib/supabase';

/**
 * Ideas, feature requests, and requests to take something away.
 *
 * Deliberately not a support form. Support is a conversation with one person
 * and needs a reply address; this is a pile read through when deciding what to
 * build next, and it carries nothing that identifies the sender — see the
 * header of migration 0120. Because there is no sender there is no reply, and
 * the screen says so twice: once in the note at the top, which points anyone
 * with an actual problem at the support address, and once above the button.
 *
 * Signing in is required purely to keep out drive-by spam. That check happens
 * inside submit_feedback() and nothing about the account is stored.
 */

/** Words, not characters. "no" and "more stuff" are not something to act on. */
const MIN_WORDS = 3;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** The three the table accepts; anything else violates its check constraint. */
function platformForFeedback(): FeedbackInput['platform'] {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
}

export default function SendFeedbackScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();

  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = countWords(message);
  const isValid = Boolean(category) && words >= MIN_WORDS;

  const handleSubmit = async () => {
    if (!isValid || !category) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback(supabase, {
        category,
        message: message.trim(),
        appRelease: APP_RELEASE,
        platform: platformForFeedback(),
      });
      setSubmitted(true);
    } catch (err) {
      // The day's allowance is the one failure the sender can act on, so it
      // gets its own words rather than a flat "that didn't send".
      if (err instanceof FeedbackDailyLimitReached) {
        setError(t('feedback.tooMany'));
      } else {
        console.error('Failed to send feedback', err);
        setError(await writeFailureMessage(session?.user.id, t('feedback.failed'), t));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.doneContent}>
            <View style={[styles.doneMark, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={30} color={theme.background} />
            </View>
            <ThemedText type="subtitle" style={styles.doneTitle}>
              {t('feedback.thanks')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.doneBody}>
              {t('feedback.thanksBody')}
            </ThemedText>
            <Pressable
              style={[styles.doneButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.back()}>
              <ThemedText type="smallBold">{t('form.done')}</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* The thing that stops this becoming a second support queue nobody
              can answer. It has to come before the box rather than after it —
              afterwards is a wasted message and a wasted evening waiting for
              a reply that cannot arrive. */}
          <Pressable
            style={[styles.scopeNote, { backgroundColor: theme.backgroundElement }]}
            onPress={() => {
              // Swallowed like every other outbound link in the app: a device
              // with no mail client is not something this screen can fix.
              Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
            }}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.scopeNoteText}>
              {t('feedback.scopeNotePrefix')}
              <ThemedText type="small" style={[styles.scopeNoteLink, { color: theme.primary }]}>
                {t('feedback.scopeNoteLink')}
              </ThemedText>
              {t('feedback.scopeNoteSuffix')}
            </ThemedText>
          </Pressable>

          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('feedback.kind')}
          </ThemedText>
          {/* Three options in the open rather than the collapsing picker the
              report sheet uses. That picker earns itself at six reasons; at
              three it is a tap spent hiding two lines of text. */}
          <View style={styles.options}>
            {FEEDBACK_CATEGORIES.map((value) => {
              const selected = category === value;
              return (
                <Pressable
                  key={value}
                  style={[
                    styles.option,
                    { borderColor: selected ? theme.primary : theme.fieldBorder },
                    selected && { backgroundColor: theme.backgroundElement },
                  ]}
                  onPress={() => setCategory(value)}>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selected ? theme.primary : theme.textSecondary}
                  />
                  <ThemedText type="default" style={styles.optionText}>
                    {t(`feedback.category.${value}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.messageLabel}>
            {t('feedback.message')}
          </ThemedText>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('feedback.placeholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            maxLength={FEEDBACK_MAX_LENGTH}
            multiline
          />
          {words > 0 && words < MIN_WORDS && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('feedback.needsWords', { count: MIN_WORDS })}
            </ThemedText>
          )}

          <View style={styles.anonRow}>
            <Ionicons name="lock-closed-outline" size={15} color={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.anonText}>
              {t('feedback.anonymous')}
            </ThemedText>
          </View>

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
              {submitting ? t('feedback.sending') : t('feedback.send')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  scopeNote: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  scopeNoteText: { lineHeight: 19 },
  scopeNoteLink: { fontWeight: '600' },
  options: { gap: Spacing.one },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  optionText: { flex: 1 },
  messageLabel: { marginTop: Spacing.two },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  anonText: { flex: 1, lineHeight: 18 },
  errorText: { color: '#E05252' },
  submitButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#ffffff' },
  doneContent: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  doneMark: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  doneTitle: { textAlign: 'center' },
  doneBody: { textAlign: 'center', maxWidth: 280 },
  doneButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    maxWidth: 280,
    marginTop: Spacing.three,
  },
});
