import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocaStarLogo } from '@/components/locastar-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <View style={styles.logo}>
            <LocaStarLogo size={72} />
          </View>
          <ThemedText type="subtitle" style={styles.brand}>
            LocaStar
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            EXPLORE. MAP. SHARE.
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
            LocaStar helps you discover, save, and review places and activities near you —
            golf courses, ski slopes, hiking trails, festivals, and more.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            Version {version}
          </ThemedText>
        </View>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  logo: {
    marginBottom: Spacing.two,
  },
  brand: {
    fontSize: 24,
    lineHeight: 30,
  },
  description: {
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  version: {
    marginTop: Spacing.four,
  },
});
