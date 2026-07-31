import { KeyboardAvoidingView, Platform, StyleSheet, type ViewProps } from 'react-native';

/**
 * Root for the bottom-sheet modals.
 *
 * The sheets sit at the bottom of the screen and several contain a text input,
 * so the on-screen keyboard covered the input and the confirm button — you
 * could neither see what you were typing nor reach "Save". Lifting the sheet
 * keeps both visible.
 *
 * iOS needs `padding`; on Android the window already resizes for the keyboard,
 * and adding a behavior there double-counts it and leaves a gap.
 */
export function SheetRoot({ style, children, ...rest }: ViewProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.root, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
