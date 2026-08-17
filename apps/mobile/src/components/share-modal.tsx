import { searchShareCandidates, type ShareCandidate } from '@locastar/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { writeFailureMessage } from '@/lib/restriction';
import { supabase } from '@/lib/supabase';

export function ShareModal({
  visible,
  onClose,
  onShare,
  title,
  successNoun,
  successMessage,
  errorMessage,
  showNote = true,
}: {
  visible: boolean;
  onClose: () => void;
  onShare: (recipientId: string, note: string | null) => Promise<void>;
  title?: string;
  successNoun?: string;
  successMessage?: (name: string) => string;
  errorMessage?: string;
  showNote?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ query: string; rows: ShareCandidate[] }>({
    query: '',
    rows: [],
  });
  const [selected, setSelected] = useState<ShareCandidate | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to ask for, so nothing to do — and deliberately no setState here.
    // Clearing the list from inside the effect is a synchronous state write on
    // every keystroke below the threshold; what should be shown is derived
    // below instead.
    if (!session || query.trim().length < 2 || selected) return;
    let cancelled = false;
    const trimmed = query.trim();
    const timeout = setTimeout(() => {
      searchShareCandidates(supabase, trimmed, session.user.id)
        .then((rows) => {
          if (!cancelled) setResults({ query: trimmed, rows });
        })
        .catch(() => {
          if (!cancelled) setResults({ query: trimmed, rows: [] });
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, session, selected]);

  /*
   * What to show, worked out rather than stored.
   *
   * Results remember the query they answer, so a slow reply for "sa" cannot
   * appear under a box that has since become "sam" — the same reason the admin
   * people search is written this way.
   */
  const visibleResults =
    !selected && query.trim().length >= 2 && results.query === query.trim() ? results.rows : [];

  const handleClose = () => {
    onClose();
    setQuery('');
    setResults({ query: '', rows: [] });
    setSelected(null);
    setNote('');
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await onShare(selected.id, note.trim() || null);
      setSubmitted(true);
    } catch {
      setError(await writeFailureMessage(session?.user.id, errorMessage ?? t('components.shareError'), t));
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
                {t('components.shared')}
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {successMessage
                  ? successMessage(selected?.username ?? selected?.displayName ?? 'They')
                  : t('components.sharedBody', {
                      name: selected?.username ?? selected?.displayName ?? t('components.theyFallback'),
                      where: successNoun ?? t('components.inTheirFavorites'),
                    })}
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
                {title ?? t('components.shareLocation')}
              </ThemedText>

              {selected ? (
                <View style={styles.selectedRow}>
                  <Avatar url={selected.avatarUrl} size={36} />
                  <ThemedText type="default" style={styles.selectedName}>
                    {selected.username ?? selected.displayName ?? 'Unnamed user'}
                  </ThemedText>
                  <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('components.change')}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('components.searchByUsername')}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                  {visibleResults.map((candidate) => (
                    <Pressable key={candidate.id} style={styles.resultRow} onPress={() => setSelected(candidate)}>
                      <Avatar url={candidate.avatarUrl} size={36} />
                      <View>
                        <ThemedText type="default">
                          {candidate.username ?? candidate.displayName ?? 'Unnamed user'}
                        </ThemedText>
                        {candidate.username && (
                          <ThemedText type="small" themeColor="textSecondary">
                            @{candidate.username}
                          </ThemedText>
                        )}
                      </View>
                    </Pressable>
                  ))}
                  {query.trim().length >= 2 && visibleResults.length === 0 && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('components.noUsersFound')}
                    </ThemedText>
                  )}
                </>
              )}

              {showNote && (
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('components.addNote')}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, styles.noteInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  multiline
                />
              )}

              {error && (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}

              <Pressable
                style={[styles.submitButton, (!selected || submitting) && styles.submitButtonDisabled]}
                disabled={!selected || submitting}
                onPress={handleSubmit}>
                <ThemedText type="smallBold" style={styles.submitButtonText}>
                  {submitting ? t('components.sharing') : t('components.shareAction')}
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
  },
  noteInput: {
    height: 70,
    textAlignVertical: 'top',
    marginTop: Spacing.two,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  selectedName: {
    flex: 1,
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
