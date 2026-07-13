import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signInWithPassword } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Log in</ThemedText>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !email || !password}
          style={[styles.submitButton, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {submitting ? 'Logging in...' : 'Log in'}
          </ThemedText>
        </Pressable>

        <View style={styles.switchRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Don&apos;t have an account?
          </ThemedText>
          <Link href="/sign-up" replace>
            <ThemedText type="linkPrimary">Sign up</ThemedText>
          </Link>
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
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  error: {
    color: '#E85C4C',
  },
  submitButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});
