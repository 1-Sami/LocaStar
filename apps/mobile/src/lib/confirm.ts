import { t } from 'i18next';
import { Alert, Platform } from 'react-native';

/**
 * A yes/no confirmation, resolved to what they chose.
 *
 * Reads the translator off the i18next singleton rather than taking one, and
 * that is deliberate: this is called from event handlers, not from render, so
 * there is no hook to use — and threading `t` through thirty call sites to
 * translate one word would be a lot of noise for "Cancel".
 *
 * The default confirm label is still Delete, because that is what most callers
 * are asking about; anything else passes its own.
 */
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel?: string
): Promise<boolean> {
  const confirmText = confirmLabel ?? t('common.delete');

  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
