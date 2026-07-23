import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  placeholder = 'Select a date',
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minimumDate?: Date;
  placeholder?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && selectedDate) onChange(selectedDate);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
      <View style={styles.row}>
        <Pressable style={styles.field} onPress={() => setShowPicker(true)}>
          <ThemedText type="default" style={value ? styles.valueText : styles.placeholderText}>
            {value ? formatDate(value) : placeholder}
          </ThemedText>
        </Pressable>
        {value && (
          <Pressable style={styles.clearButton} onPress={() => onChange(null)} hitSlop={8}>
            <ThemedText type="small" style={styles.clearText}>
              Clear
            </ThemedText>
          </Pressable>
        )}
      </View>
      {showPicker && (
        <DateTimePicker
          value={value ?? minimumDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  label: {
    marginTop: -Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.15)',
  },
  valueText: {
    color: '#000000',
  },
  placeholderText: {
    color: '#6B6B6B',
  },
  clearButton: {
    paddingHorizontal: Spacing.one,
  },
  clearText: {
    color: '#E05252',
  },
});
