import * as Updates from 'expo-updates';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocaStarLogo } from '@/components/locastar-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_RELEASE } from '@/constants/release';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** One "Bold lead-in. Rest of the sentence." row in the features list. */
function Feature({ lead, children }: { lead: string; children: string }) {
  return (
    <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
      <ThemedText type="default" style={styles.featureLead}>
        {lead}
      </ThemedText>{' '}
      {children}
    </ThemedText>
  );
}

export default function AboutScreen() {
  // APP_RELEASE moves with every published update, so "which version am I on?"
  // has a real answer. The line underneath is for us rather than for users:
  // when someone reports a bug, the update id says exactly which bundle they
  // were running, which beats guessing whether they already have the fix.
  const buildLabel = Updates.isEmbeddedLaunch
    ? 'Original install — no updates applied yet'
    : `Update ${Updates.updateId?.slice(0, 8) ?? 'unknown'}` +
      (Updates.createdAt ? ` · ${Updates.createdAt.toISOString().slice(0, 16).replace('T', ' ')}` : '');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <LocaStarLogo size={72} />
            <ThemedText type="subtitle" style={styles.brand}>
              LocaStar
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
              EXPLORE. MAP. SHARE.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              It started with a basketball
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              Every time I found myself in a new part of town with a ball under my arm, I hit the same
              question: where do I actually go and play?
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              The answer was usually out there somewhere. I'd scan the map for nearby schools and parks,
              guess which ones might have a court, then hope it was open, decent, and worth the trip.
              Sometimes that worked. Often I'd walk twenty minutes to find a bent rim and no net.
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              That's the whole reason LocaStar exists.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              The places between the listings
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              Map apps are built around businesses, and they're very good at it. Activities are just
              harder to pin down — a basketball court isn't a listing of its own, it's tucked inside a
              school or a park. Finding one means guessing which places might have it, then checking them
              one by one.
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              So that knowledge stays scattered. A little on a forum, a little in a group chat, and most
              of it in the heads of people who already live there. If you're new to an area — or just new
              to that side of town — it may as well not exist.
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              So we built LocaStar around that gap: one map of things to actually go and do, described by
              the people who have been there.
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              LocaStar starts from the activity instead. You look for a court, a slope, a trail or a
              festival, and you get the spot itself: what it's like, who's been there, and how to get to
              it.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              What you can do here
            </ThemedText>
            <Feature lead="Find places worth going to.">
              Search by activity or browse what's near you, with ratings, photos and directions from
              people who actually showed up.
            </Feature>
            <Feature lead="Save and organise.">
              Keep favourites, build a "want to go" list, and group places into lists you can keep private
              or share with everyone.
            </Feature>
            <Feature lead="Plan something private.">
              Organising a party, a wedding, or a film shoot? Create it as a private activity and share it
              only with the people you invite.
            </Feature>
            <Feature lead="Leave something behind.">
              Add a rating, a photo, or a spot nobody has listed yet.
            </Feature>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              The map grows with you
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              LocaStar is young, and we'd rather say so than pretend otherwise: some areas are already
              full, others are nearly empty. It gets better every time someone adds a place they know.
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              So if you know the good court, the quiet trail, or the slope that's worth the drive — add
              it. The next person turning up with a ball under their arm will be glad you did.
            </ThemedText>
          </View>

          <View style={styles.legalRow}>
            <Link href={'/legal/privacy' as never}>
              <ThemedText type="linkPrimary">Privacy Policy</ThemedText>
            </Link>
            <ThemedText type="small" themeColor="textSecondary">
              ·
            </ThemedText>
            <Link href={'/legal/terms' as never}>
              <ThemedText type="linkPrimary">Terms of Service</ThemedText>
            </Link>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            Application AB · Version v{APP_RELEASE}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.buildLine}>
            {buildLabel}
          </ThemedText>
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
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  brand: {
    fontSize: 24,
    lineHeight: 30,
    marginTop: Spacing.two,
  },
  tagline: {
    letterSpacing: 2,
    fontSize: 10,
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  paragraph: {
    fontWeight: '400',
    lineHeight: 23,
  },
  featureLead: {
    fontWeight: '700',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  version: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  buildLine: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
