import * as Updates from 'expo-updates';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocaStarLogo } from '@/components/locastar-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_RELEASE } from '@/constants/release';
import { SUPPORT_EMAIL } from '@/constants/support';
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
  const { t } = useTranslation();
  // APP_RELEASE moves with every published update, so "which version am I on?"
  // has a real answer. The line underneath is for us rather than for users:
  // when someone reports a bug, the update id says exactly which bundle they
  // were running, which beats guessing whether they already have the fix.
  const buildLabel = Updates.isEmbeddedLaunch
    ? t('about.originalInstall')
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
              {t('home.tagline')}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {t('about.ballTitle')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.ball1')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.ball2')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.ball3')}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {t('about.gapTitle')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.gap1')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.gap2')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.gap3')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.gap4')}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {t('about.doTitle')}
            </ThemedText>
            <Feature lead={t('about.findLead')}>
              {t('about.findBody')}
            </Feature>
            <Feature lead={t('about.saveLead')}>
              {t('about.saveBody')}
            </Feature>
            <Feature lead={t('about.privateLead')}>
              {t('about.privateBody')}
            </Feature>
            <Feature lead={t('about.contributeLead')}>
              {t('about.contributeBody')}
            </Feature>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {t('about.growTitle')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.grow1')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
              {t('about.grow2')}
            </ThemedText>
          </View>

          {/* This screen is what locastar.se/about serves, and that URL is the
              App Store / Play support link. Both stores check that the page
              visibly offers a way to reach a human, so the address has to be
              here in the open — the legal pages carrying it is not enough. */}
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {t('about.supportTitle')}
            </ThemedText>
            <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
              <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
                {t('about.supportPrefix')}
                <ThemedText type="default" style={styles.supportLink}>
                  {SUPPORT_EMAIL}
                </ThemedText>
                {t('about.supportSuffix')}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.legalRow}>
            <Link href={'/legal/privacy' as never}>
              <ThemedText type="linkPrimary">{t('nav.privacyPolicy')}</ThemedText>
            </Link>
            <ThemedText type="small" themeColor="textSecondary">
              ·
            </ThemedText>
            <Link href={'/legal/terms' as never}>
              <ThemedText type="linkPrimary">{t('nav.termsOfService')}</ThemedText>
            </Link>
          </View>

          {/* Attribution is a condition of the ODbL licence the imported
              locations arrive under, not a courtesy. It has to be somewhere a
              user can reach from the data itself, and the About screen is the
              place OpenStreetMap's own guidance names for an app. Removing this
              line puts the imported data out of licence. */}
          <Pressable onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
              {t('about.attributionPrefix')}
              <ThemedText type="small" style={styles.attributionLink}>
                {t('about.attributionLink')}
              </ThemedText>
              {t('about.attributionSuffix')}
            </ThemedText>
          </Pressable>

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
  supportLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  attribution: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  attributionLink: {
    textDecorationLine: 'underline',
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
