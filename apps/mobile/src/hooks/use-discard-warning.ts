import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler } from 'react-native';

import { confirmAsync } from '@/lib/confirm';

/**
 * Asks before abandoning a part-filled form.
 *
 * Built on BackHandler and a custom header button rather than react-navigation's
 * `usePreventRemove`: expo-router 57 vendors its own copy of react-navigation
 * and does not re-export that hook, so reaching it means a deep import into
 * `expo-router/build/react-navigation/core`, which is unversioned and would
 * break on any upgrade with no type error to warn us.
 *
 * `onBack` covers the header arrow. The returned `confirmLeave` is also wired to
 * the Android hardware back button here, since that is how most people actually
 * leave a screen and it bypasses the header entirely.
 */
export function useDiscardWarning(hasChanges: boolean, message: string) {
  const router = useRouter();
  const { t } = useTranslation();

  const confirmLeave = useCallback(async () => {
    if (!hasChanges) return true;
    return confirmAsync(t('common.discardTitle'), message, t('common.discard'));
  }, [hasChanges, message, t]);

  const onBack = useCallback(async () => {
    if (await confirmLeave()) router.back();
  }, [confirmLeave, router]);

  useEffect(() => {
    // Returning false lets the OS do its normal thing, which is what we want
    // the moment there is nothing worth keeping.
    if (!hasChanges) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void confirmLeave().then((leave) => {
        if (leave) router.back();
      });
      return true;
    });
    return () => subscription.remove();
  }, [hasChanges, confirmLeave, router]);

  return { onBack };
}
