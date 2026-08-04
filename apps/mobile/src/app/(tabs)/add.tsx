import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

/**
 * The Add tab.
 *
 * A tab has to point at a screen, and add-location needs to know up front
 * whether it is collecting a place or an activity — the two forms genuinely
 * differ, one wants opening hours and a phone number, the other dates and a
 * contact. So the tab lands here and asks, rather than guessing and making
 * people back out.
 */
export default function AddScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();

  const options = [
    {
      kind: 'place' as const,
      icon: 'location-outline' as const,
      color: '#C34CE8',
      title: 'A place',
      body: 'A court, a trail, a gym, a swimming spot — somewhere that is always there.',
    },
    {
      kind: 'activity' as const,
      icon: 'calendar-outline' as const,
      color: '#E8A93B',
      title: 'An activity',
      body: 'A festival, a match, a meet-up — something happening on a date.',
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle" style={styles.header}>
            Add to the map
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.intro}>
            LocaStar is only as good as what people put in it. If you know somewhere worth going, add
            it — the next person looking will be glad you did.
          </ThemedText>

          {!session ? (
            <View style={styles.signedOut}>
              <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                You need an account to add to the map.
              </ThemedText>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/sign-in')}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  Log in
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => router.push('/sign-up')}>
                <ThemedText type="linkPrimary">Create an account</ThemedText>
              </Pressable>
            </View>
          ) : (
            options.map((option) => (
              <Pressable
                key={option.kind}
                style={[styles.card, { borderColor: option.color }]}
                onPress={() => router.push({ pathname: '/add-location', params: { kind: option.kind } })}>
                <View style={[styles.cardIcon, { backgroundColor: `${option.color}26` }]}>
                  <Ionicons name={option.icon} size={26} color={option.color} />
                </View>
                <View style={styles.cardText}>
                  <ThemedText type="smallBold" style={styles.cardTitle}>
                    {option.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {option.body}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    fontSize: 24,
    lineHeight: 30,
  },
  intro: {
    marginBottom: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 17,
  },
  signedOut: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  centerText: {
    textAlign: 'center',
  },
  primaryButton: {
    paddingHorizontal: Spacing.five,
    height: 44,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
});
