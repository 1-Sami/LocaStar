import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** Shared chrome for the Privacy Policy and Terms screens. */
export function LegalPage({ lastUpdated, children }: { lastUpdated: string; children: ViewProps['children'] }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Last updated {lastUpdated}
          </ThemedText>
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

export function LegalSection({ title, children }: { title: string; children: ViewProps['children'] }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

export function LegalText({ children }: { children: ViewProps['children'] }) {
  return (
    <ThemedText type="default" themeColor="textSecondary" style={styles.paragraph}>
      {children}
    </ThemedText>
  );
}

/** A bulleted line. Kept simple so the text stays readable at any font size. */
export function LegalBullet({ children }: { children: ViewProps['children'] }) {
  return (
    <View style={styles.bulletRow}>
      <ThemedText type="default" themeColor="textSecondary" style={styles.bulletDot}>
        •
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={[styles.paragraph, styles.bulletText]}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 17, lineHeight: 22 },
  paragraph: { fontWeight: '400', lineHeight: 23 },
  bulletRow: { flexDirection: 'row', gap: Spacing.two },
  bulletDot: { lineHeight: 23 },
  bulletText: { flex: 1 },
});
