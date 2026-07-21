import type { DayKey, OpeningHours } from '@locastar/shared';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const LIGHT_PLACEHOLDER = '#6B6B6B';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export function OpeningHoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  const toggleDay = (day: DayKey) => {
    const next = { ...hours };
    if (next[day]) {
      delete next[day];
    } else {
      next[day] = { open: '09:00', close: '17:00' };
    }
    onChange(next);
  };

  return (
    <View style={styles.hoursCard}>
      <ThemedText type="smallBold" style={styles.hoursCardTitle}>
        Open hours (optional)
      </ThemedText>
      {DAYS.map((day) => {
        const entry = hours[day.key];
        const isOpen = Boolean(entry);
        return (
          <View key={day.key} style={styles.hoursRow}>
            <Pressable style={styles.hoursDayToggle} onPress={() => toggleDay(day.key)}>
              <View style={[styles.lightCheckbox, isOpen && styles.checkboxChecked]} />
              <ThemedText type="small" style={styles.hoursDayLabel}>
                {day.label}
              </ThemedText>
            </Pressable>
            {isOpen && (
              <View style={styles.hoursTimeRow}>
                <TextInput
                  value={entry?.open}
                  onChangeText={(text) => onChange({ ...hours, [day.key]: { open: text, close: entry?.close ?? '17:00' } })}
                  placeholder="09:00"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  style={[styles.input, styles.hoursTimeInput]}
                />
                <ThemedText type="small" style={styles.hoursDash}>
                  –
                </ThemedText>
                <TextInput
                  value={entry?.close}
                  onChangeText={(text) => onChange({ ...hours, [day.key]: { open: entry?.open ?? '09:00', close: text } })}
                  placeholder="17:00"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  style={[styles.input, styles.hoursTimeInput]}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  hoursCard: {
    backgroundColor: '#ffffff',
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  hoursCardTitle: {
    color: '#000000',
  },
  hoursRow: {
    gap: Spacing.one,
  },
  hoursDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hoursDayLabel: {
    color: '#000000',
  },
  lightCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.3)',
    borderRadius: Spacing.half,
  },
  hoursTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginLeft: Spacing.five,
  },
  hoursTimeInput: {
    flex: 1,
    backgroundColor: '#F0F0F3',
    borderColor: 'rgba(0,0,0,0.1)',
    color: '#000000',
    paddingVertical: Spacing.one,
  },
  hoursDash: {
    color: '#000000',
  },
  checkboxChecked: {
    backgroundColor: '#14747A',
    borderColor: '#14747A',
  },
});
