import { KeyboardAvoidingView, Platform, StyleSheet, type ViewProps } from 'react-native';

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
 */
export function SheetRoot({ style, children, ...rest }: ViewProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.root, style]}
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
