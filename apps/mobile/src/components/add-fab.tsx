import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

/**
 * The "add a place" button, on the two screens where you browse.
 *
 * Contributing used to live only in the Profile menu, three taps from anywhere
 * you were actually looking at the map — which is a poor place for the one
 * action the whole app depends on. It sits here rather than in the tab bar
 * because iOS shows at most five tabs and collapses the rest into "More", so a
 * sixth would have cost Home, Search, Community, Saved or Profile its slot.
 *
 * Tapping asks place or activity, because add-location needs to know which:
 * an activity collects dates and a contact, a place collects hours and a phone.
 */
export function AddFab() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  const go = (kind: 'place' | 'activity') => {
    setMenuVisible(false);
    // Submitting needs an account, so send anyone signed out to log in first
    // rather than letting them fill in a whole form and fail at the end.
    if (!session) {
      router.push('/sign-in');
      return;
    }
    router.push({ pathname: '/add-location', params: { kind } });
  };

  return (
    <>
      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setMenuVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a location or activity">
        <Ionicons name="add" size={30} color="#ffffff" />
      </Pressable>

      <Modal visible={menuVisible} animationType="slide" transparent onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Add to the map
            </ThemedText>

            <Pressable style={styles.modalRow} onPress={() => go('place')}>
              <View style={[styles.rowIcon, { backgroundColor: '#C34CE833' }]}>
                <Ionicons name="location-outline" size={20} color="#C34CE8" />
              </View>
              <View style={styles.rowText}>
                <ThemedText type="default">A place</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  A court, a trail, a gym — somewhere that is always there.
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.modalRow} onPress={() => go('activity')}>
              <View style={[styles.rowIcon, { backgroundColor: '#E8A93B33' }]}>
                <Ionicons name="calendar-outline" size={20} color="#E8A93B" />
              </View>
              <View style={styles.rowText}>
                <ThemedText type="default">An activity</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  A festival, a match, a meet-up — something with a date.
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.four,
    // Clears the tab bar, which sits above everything on this screen.
    bottom: BottomTabInset + Spacing.two,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    // Enough lift to read as floating over the cards it overlaps.
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
