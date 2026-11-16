import { ALWAYS_OPEN, isAlwaysOpen, type DayKey, type OpeningHours } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LIGHT_PLACEHOLDER = '#6B6B6B';

// Names come from days.* so this and the location screen cannot disagree.
const DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function OpeningHoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const toggleDay = (day: DayKey) => {
    const next = { ...hours };
    if (next[day]) {
      delete next[day];
    } else {
      next[day] = { open: '09:00', close: '17:00' };
    }
    onChange(next);
  };

  const alwaysOpen = isAlwaysOpen(hours);

  /*
   * Seven days is seven rows before anyone has said anything, and each one
   * that gets ticked grows two more fields — so the common case, a place open
   * the same hours most days, scrolled past everything below it.
   *
   * Collapsed shows Monday *and anything already filled in*. Showing only
   * Monday would have been simpler and would have hidden Tuesday's hours from
   * somebody who set them, which reads as having lost them. That also makes
   * this safe on the edit form, where the hours arrive already populated.
   */
  const visibleDays = expanded ? DAYS : DAYS.filter((day) => day === 'mon' || hours[day]);
  const foldedAway = DAYS.length - visibleDays.length;

  return (
    <View style={styles.hoursCard}>
      <ThemedText type="smallBold" style={styles.hoursCardTitle}>
        {t('components.openHours')}
      </ThemedText>

      {/* A public park or an outdoor gym is genuinely always open. Without
          this the only honest options were leaving the hours blank, which
          reads as "nobody knows", or typing 00:00-24:00 seven times. */}
      <Pressable style={styles.alwaysOpenRow} onPress={() => onChange(alwaysOpen ? {} : ALWAYS_OPEN)}>
        <View style={[styles.lightCheckbox, alwaysOpen && styles.checkboxChecked]} />
        <ThemedText type="small" style={styles.hoursDayLabel}>
          {t('components.openAlways')}
        </ThemedText>
      </Pressable>

      {!alwaysOpen &&
        visibleDays.map((day) => {
        const entry = hours[day];
        const isOpen = Boolean(entry);
        return (
          <View key={day} style={styles.hoursRow}>
            <Pressable style={styles.hoursDayToggle} onPress={() => toggleDay(day)}>
              <View style={[styles.lightCheckbox, isOpen && styles.checkboxChecked]} />
              <ThemedText type="small" style={styles.hoursDayLabel}>
                {t(`days.${day}`)}
              </ThemedText>
            </Pressable>
            {isOpen && (
              <View style={styles.hoursTimeRow}>
                <TextInput
                  value={entry?.open}
                  onChangeText={(text) => onChange({ ...hours, [day]: { open: text, close: entry?.close ?? '17:00' } })}
                  placeholder="09:00"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  style={[styles.input, styles.hoursTimeInput]}
                />
                <ThemedText type="small" style={styles.hoursDash}>
                  –
                </ThemedText>
                <TextInput
                  value={entry?.close}
                  onChangeText={(text) => onChange({ ...hours, [day]: { open: entry?.open ?? '09:00', close: text } })}
                  placeholder="17:00"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  style={[styles.input, styles.hoursTimeInput]}
                />
              </View>
            )}
          </View>
        );
      })}

      {/* Only when there is something to unfold, and it doubles as the way
          back — otherwise opening the list would be a one-way door. */}
      {!alwaysOpen && (foldedAway > 0 || expanded) && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? t('components.fewerDays') : t('components.moreDays')}
          hitSlop={8}
          style={styles.foldToggle}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Centred under the days rather than beside them: it belongs to the whole
     list, not to Sunday. */
  foldToggle: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.38)',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  alwaysOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  hoursCard: {
    backgroundColor: '#ffffff',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.38)',
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
