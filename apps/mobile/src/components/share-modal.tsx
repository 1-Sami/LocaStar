import { searchProfilesByUsername, type ShareCandidate } from '@locastar/shared';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { placeholderImage } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

export function ShareModal({
  visible,
  onClose,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  onShare: (recipientId: string, note: string | null) => Promise<void>;
}) {
  const theme = useTheme();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShareCandidate[]>([]);
  const [selected, setSelected] = useState<ShareCandidate | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || query.trim().length < 2 || selected) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      searchProfilesByUsername(supabase, query.trim(), session.user.id)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, session, selected]);

  const handleClose = () => {
    onClose();
    setQuery('');
    setResults([]);
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
      setError('Something went wrong sharing this location. Try again.');
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
                Shared!
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {selected?.displayName ?? selected?.username} will see it in their Favorites.
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
                Share this location
              </ThemedText>

              {selected ? (
                <View style={styles.selectedRow}>
                  <Image
                    source={{ uri: selected.avatarUrl ?? placeholderImage(`avatar-${selected.id}`) }}
                    style={styles.avatar}
                  />
                  <ThemedText type="default" style={styles.selectedName}>
                    {selected.displayName ?? selected.username}
                  </ThemedText>
                  <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Change
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by username"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                  {results.map((candidate) => (
                    <Pressable key={candidate.id} style={styles.resultRow} onPress={() => setSelected(candidate)}>
                      <Image
                        source={{ uri: candidate.avatarUrl ?? placeholderImage(`avatar-${candidate.id}`) }}
                        style={styles.avatar}
                      />
                      <View>
                        <ThemedText type="default">{candidate.displayName ?? candidate.username}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          @{candidate.username}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))}
                  {query.trim().length >= 2 && results.length === 0 && (
                    <ThemedText type="small" themeColor="textSecondary">
                      No users found.
                    </ThemedText>
                  )}
                </>
              )}

              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, styles.noteInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                multiline
              />

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
                  {submitting ? 'Sharing…' : 'Share'}
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
