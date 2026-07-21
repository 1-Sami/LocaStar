import {
  addLocationPhoto,
  fetchCategories,
  submitBusinessClaim,
  submitLocation,
  type Category,
  type DayKey,
  type LocationKind,
  type OpeningHours,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapPinPicker, type MapCoords } from '@/components/map-pin-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useAuth } from '@/lib/auth-context';
import { pickImage, uploadImageToMedia } from '@/lib/media-upload';
import { supabase } from '@/lib/supabase';

function formatReverseGeocodeResult(result: Location.LocationGeocodedAddress): string {
  const line1 = [result.name, result.street].filter(Boolean).join(' ');
  const line2 = [result.postalCode, result.city].filter(Boolean).join(' ');
  return [line1, line2, result.country].filter((part) => part && part.trim()).join(', ');
}

const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const MAX_ACTIVITY_DAYS = 120;

const HEADER_CONFIG = {
  place: { icon: 'add-circle-outline' as const, color: '#C34CE8', label: 'Add location' },
  activity: { icon: 'time-outline' as const, color: '#E8A93B', label: 'Add activity' },
};

const DISCLAIMER = {
  place:
    'Any location that is added will be checked and approved by a contributor. If you are a contributor, you will not be able to validate your own submissions. Validation can take up to 4 days before the location becomes visible. Locations added in violation of the rules will result in a warning — repeated invalid submissions will get your account blocked from creating new locations.',
  activity:
    'Any activity that is unlawful or not created by its rightful owner will result in a block on creating future activities. All activities must follow the rules — violations may result in a ban and could lead to legal action from the rightful owner.',
};

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.yesNoRow}>
      <ThemedText type="default">{label}</ThemedText>
      <View style={styles.yesNoOptions}>
        <Pressable style={styles.yesNoOption} onPress={() => onChange(true)}>
          <ThemedText type="small">YES</ThemedText>
          <View style={[styles.checkbox, value && styles.checkboxChecked]} />
        </Pressable>
        <Pressable style={styles.yesNoOption} onPress={() => onChange(false)}>
          <ThemedText type="small">NO</ThemedText>
          <View style={[styles.checkbox, !value && styles.checkboxChecked]} />
        </Pressable>
      </View>
    </View>
  );
}

function OpeningHoursEditor({ hours, onChange }: { hours: OpeningHours; onChange: (next: OpeningHours) => void }) {
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

export default function AddLocationScreen() {
  const { kind } = useLocalSearchParams<{ kind: LocationKind }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { coords } = useUserLocation();

  const isActivity = kind === 'activity';
  const noun = isActivity ? 'activity' : 'location';
  const headerConfig = isActivity ? HEADER_CONFIG.activity : HEADER_CONFIG.place;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState<OpeningHours>({});
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUris, setPhotoUris] = useState<(string | null)[]>([null, null, null]);
  const [pinCoords, setPinCoords] = useState<MapCoords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [visibleAsCreator, setVisibleAsCreator] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchCategories(supabase)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (coords && !pinCoords) setPinCoords(coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const handlePinChange = (next: MapCoords) => {
    setPinCoords(next);
    setGeocoding(true);
    Location.reverseGeocodeAsync(next)
      .then((results) => {
        const formatted = results[0] ? formatReverseGeocodeResult(results[0]) : '';
        if (formatted) setAddress(formatted);
      })
      .catch(() => {})
      .finally(() => setGeocoding(false));
  };

  const selectedCategoryLabel = categories
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => c.name)
    .join(', ');

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]
    );
  };

  const handlePickPhoto = async (index: number) => {
    const uri = await pickImage();
    if (!uri) return;
    setPhotoUris((current) => {
      const next = [...current];
      next[index] = uri;
      return next;
    });
  };

  const hasPhoto = photoUris.some(Boolean);
  const emailValid = !isActivity || EMAIL_PATTERN.test(email.trim());
  const canSubmit =
    Boolean(name.trim() && address.trim() && categoryIds.length > 0 && hasPhoto && pinCoords && emailValid) &&
    !submitting;

  let endDateWarning: string | null = null;
  let expiresAtIso: string | null = null;
  if (isActivity) {
    const trimmed = endDate.trim();
    if (!trimmed) {
      endDateWarning = `No end date chosen — this activity will automatically be removed after ${MAX_ACTIVITY_DAYS} days.`;
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        endDateWarning = 'Enter the end date as YYYY-MM-DD.';
      } else {
        expiresAtIso = parsed.toISOString();
        const daysOut = (parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysOut > MAX_ACTIVITY_DAYS) {
          endDateWarning = `Activities can only stay active for up to ${MAX_ACTIVITY_DAYS} days — this will be capped automatically.`;
        }
      }
    }
  }

  const handleSubmit = async () => {
    if (!session || !pinCoords || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const locationId = await submitLocation(supabase, {
        kind: isActivity ? 'activity' : 'place',
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim(),
        lat: pinCoords.latitude,
        lng: pinCoords.longitude,
        categoryIds,
        userId: session.user.id,
        phone: isActivity ? null : phone.trim() || null,
        website: isActivity ? null : website.trim() || null,
        email: isActivity ? email.trim() : null,
        hours: Object.keys(hours).length > 0 ? hours : null,
        creatorVisible: visibleAsCreator,
        visibility: isActivity && isPrivate ? 'private' : 'public',
        expiresAt: isActivity ? expiresAtIso : null,
      });

      for (const uri of photoUris) {
        if (!uri) continue;
        const path = `locations/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        await uploadImageToMedia(path, uri);
        await addLocationPhoto(supabase, locationId, session.user.id, path);
      }

      if (isOwner) {
        await submitBusinessClaim(supabase, locationId, session.user.id, null).catch(() => {});
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong submitting your ' + noun + '. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: headerConfig.label }} />
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.confirmation}>
            <ThemedText type="subtitle" style={styles.confirmationTitle}>
              Thanks!
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              Your {noun} has been submitted for review. It'll go live once it's approved.
            </ThemedText>
            <Pressable style={styles.submitButton} onPress={() => router.back()}>
              <ThemedText type="smallBold" style={styles.submitButtonText}>
                Done
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: headerConfig.label }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Ionicons name={headerConfig.icon} size={22} color={headerConfig.color} />
            <ThemedText type="subtitle" style={[styles.headerTitle, { color: headerConfig.color }]}>
              {headerConfig.label}
            </ThemedText>
          </View>

          <ThemedText type="smallBold" style={styles.photoLabel}>
            {isActivity ? 'Add 1-3 pictures' : '*Add a minimum of 1 picture'}
          </ThemedText>

          <View style={styles.photoRow}>
            {photoUris.map((uri, index) => (
              <Pressable key={index} style={styles.photoSlot} onPress={() => handlePickPhoto(index)}>
                {uri ? (
                  <Image source={{ uri }} style={styles.photoSlotImage} contentFit="cover" />
                ) : (
                  <View style={styles.photoSlotEmpty}>
                    <Ionicons name="add" size={28} color={theme.text} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={isActivity ? '*Name of activity' : '*Name of location'}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput]}
          />

          <ThemedText type="smallBold" style={styles.mapLabel}>
            *Pin the exact location
          </ThemedText>
          {pinCoords ? (
            <MapPinPicker
              initialLatitude={pinCoords.latitude}
              initialLongitude={pinCoords.longitude}
              onChange={handlePinChange}
            />
          ) : (
            <View style={styles.mapLoading}>
              <ThemedText type="small" themeColor="textSecondary">
                Finding your location…
              </ThemedText>
            </View>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            Tap or drag the pin to set exactly where this {noun} is.
          </ThemedText>

          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={geocoding ? 'Looking up address…' : '*Address'}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput]}
          />

          <Pressable style={[styles.input, styles.lightInput, styles.categoryInput]} onPress={() => setPickerVisible(true)}>
            <ThemedText type="default" style={[styles.categoryInputText, !selectedCategoryLabel && styles.lightPlaceholderText]} numberOfLines={1}>
              {selectedCategoryLabel || '*Location type/Category'}
            </ThemedText>
            <Ionicons name="chevron-down" size={16} color="#000000" />
          </Pressable>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Additional information (optional)"
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput, styles.bodyInput]}
            multiline
          />

          <OpeningHoursEditor hours={hours} onChange={setHours} />

          {isActivity ? (
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="*Email"
              placeholderTextColor={LIGHT_PLACEHOLDER}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, styles.lightInput]}
            />
          ) : (
            <>
              <TextInput
                value={website}
                onChangeText={setWebsite}
                placeholder="Website (optional)"
                placeholderTextColor={LIGHT_PLACEHOLDER}
                autoCapitalize="none"
                style={[styles.input, styles.lightInput]}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number (optional)"
                placeholderTextColor={LIGHT_PLACEHOLDER}
                keyboardType="phone-pad"
                style={[styles.input, styles.lightInput]}
              />
            </>
          )}

          {isActivity && (
            <>
              <YesNoRow
                label="Make this a private activity (only visible to people you share it with, e.g. a party or wedding)?"
                value={isPrivate}
                onChange={setIsPrivate}
              />

              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="End date (YYYY-MM-DD, optional)"
                placeholderTextColor={LIGHT_PLACEHOLDER}
                style={[styles.input, styles.lightInput]}
              />
              {endDateWarning && (
                <ThemedText type="small" style={styles.warningText}>
                  {endDateWarning}
                </ThemedText>
              )}
            </>
          )}

          <YesNoRow
            label="Do you want to be visible as the creator?"
            value={visibleAsCreator}
            onChange={setVisibleAsCreator}
          />

          <YesNoRow label={`Are you the owner of the ${noun}?`} value={isOwner} onChange={setIsOwner} />

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              {submitting ? 'Submitting…' : `Submit ${noun}`}
            </ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
            {isActivity ? DISCLAIMER.activity : DISCLAIMER.place}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Categories
            </ThemedText>
            <ScrollView>
              {categories.map((category) => (
                <Pressable key={category.id} style={styles.modalRow} onPress={() => toggleCategory(category.id)}>
                  <ThemedText type="default">{category.name}</ThemedText>
                  <ThemedText type="default">{categoryIds.includes(category.id) ? '✓' : ''}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.doneButton} onPress={() => setPickerVisible(false)}>
              <ThemedText type="smallBold" style={styles.submitButtonText}>
                Done
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const LIGHT_PLACEHOLDER = '#6B6B6B';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 26,
    textDecorationLine: 'underline',
  },
  photoLabel: {
    marginTop: -Spacing.one,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  photoSlot: {
    flex: 1,
    aspectRatio: 1,
  },
  photoSlotEmpty: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotImage: {
    flex: 1,
    borderRadius: Spacing.two,
  },
  mapLabel: {
    marginTop: -Spacing.one,
  },
  mapLoading: {
    height: 220,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  bodyInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  lightInput: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.15)',
    color: '#000000',
  },
  lightPlaceholderText: {
    color: LIGHT_PLACEHOLDER,
  },
  categoryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryInputText: {
    flex: 1,
    color: '#000000',
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
  yesNoRow: {
    gap: Spacing.two,
  },
  yesNoOptions: {
    flexDirection: 'row',
    gap: Spacing.five,
  },
  yesNoOption: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: Spacing.half,
  },
  checkboxChecked: {
    backgroundColor: '#14747A',
    borderColor: '#14747A',
  },
  warningText: {
    color: '#E8A93B',
    marginTop: -Spacing.one,
  },
  errorText: {
    color: '#E05252',
  },
  submitButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
  },
  disclaimer: {
    marginTop: Spacing.one,
  },
  confirmation: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  confirmationTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  centerText: {
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  doneButton: {
    height: 44,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
});
