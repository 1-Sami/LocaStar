import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function PasswordInput({ style, ...rest }: TextInputProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput {...rest} secureTextEntry={!visible} style={[style, styles.input]} />
      <Pressable style={styles.toggle} onPress={() => setVisible((current) => !current)} hitSlop={10}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
  },
  input: {
    paddingRight: 44,
  },
  toggle: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
});
