import { KeyboardAvoidingView, Platform, StyleSheet, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Root for the bottom-sheet modals.
 *
 * The sheets sit at the bottom of the screen and several contain a text input,
 * so the on-screen keyboard covered the input and the confirm button — you
 * could neither see what you were typing nor reach "Save". Lifting the sheet
 * keeps both visible.
 *
 * Android needs a behavior too, and used to be left as `undefined` here on the
 * belief that "the window already resizes for the keyboard". It does not: a
 * React Native Modal is its own Android window and does not inherit the
 * activity's adjustResize, so the hook did nothing and every sheet stayed under
 * the keyboard. `height` shrinks the sheet instead, which is what iOS gets from
 * `padding`.
 *
 * The bottom inset is the same problem one layer down. A sheet is pinned to
 * the bottom of its own window, and on a phone with Android's three-button
 * navigation bar — or an iPhone's home indicator — the last thing in it ends
 * up underneath that bar: the "Done" button on Add to list, the final row of a
 * menu. Reported on an S10. Padding the root lifts every sheet clear of it at
 * once, which is why this belongs here and not in each of the ten screens and
 * components that use it.
 */
export function SheetRoot({ style, children, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      {...rest}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
