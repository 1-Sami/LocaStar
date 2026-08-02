import {
  addLocationPhoto,
  fetchCategories,
  fetchNearbyLocations,
  submitBusinessClaim,
  submitLocation,
  type Category,
  type LocationKind,
  type NearbyLocation,
  type OpeningHours,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { MapPinPicker, type MapCoords } from '@/components/map-pin-picker';
import { OpeningHoursEditor } from '@/components/opening-hours-editor';
import { PhotoPicker } from '@/components/photo-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useAuth } from '@/lib/auth-context';
import { uploadImageToMedia } from '@/lib/media-upload';
import { writeFailureMessage } from '@/lib/restriction';
import { supabase } from '@/lib/supabase';

function formatStreetLine(result: Location.LocationGeocodedAddress): string {
  // Swedish street addresses put the number after the name (e.g. "Sturevägen 6"),
  // so build from `street`/`streetNumber` directly rather than the ambiguous
  // `name` field, whose ordering isn't consistent across platforms.
  return [result.street, result.streetNumber].filter(Boolean).join(' ');
}

function resolveCity(result: Location.LocationGeocodedAddress): string | null {
  // `city` frequently comes back null from the geocoder for addresses outside
  // a major urban core — fall back to the district/subregion, which is
  // usually the actual town/city name in that case.
  return result.city || result.subregion || result.district || null;
}

function formatCityLine(result: Location.LocationGeocodedAddress): string {
  return [result.postalCode, resolveCity(result)].filter(Boolean).join(' ');
}

// Roughly a city block. Wide enough to catch the same court pinned slightly
// differently, tight enough not to list every place in the neighbourhood.
const DUPLICATE_RADIUS_M = 200;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const MAX_ACTIVITY_DAYS = 120;

const HEADER_CONFIG = {
  place: { icon: 'add-circle-outline' as const, color: '#C34CE8', label: 'Add location' },
  activity: { icon: 'time-outline' as const, color: '#E8A93B', label: 'Add activity' },
};

const DISCLAIMER = {
  place:
    'Locations go live as soon as you submit them, and are moderated afterwards. Anyone can report a location that is misleading, unlawful, or in the wrong place, and reported locations are reviewed and can be hidden or removed. Adding locations in violation of the rules will result in a warning — repeated invalid submissions will get your account blocked from creating new locations.',
  activity:
    'Any activity that is unlawful or not created by its rightful owner will result in a block on creating future activities. All activities must follow the rules — violations may result in a ban and could lead to legal action from the rightful owner.',
};

function YesNoRow({
  label,
  value,
  onChange,
  yesLabel = 'YES',
  noLabel = 'NO',
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <View style={styles.yesNoRow}>
      <ThemedText type="default">{label}</ThemedText>
      <View style={styles.yesNoOptions}>
        <Pressable style={styles.yesNoOption} onPress={() => onChange(true)}>
          <ThemedText type="small">{yesLabel}</ThemedText>
          <View style={[styles.checkbox, value === true && styles.checkboxChecked]} />
        </Pressable>
        <Pressable style={styles.yesNoOption} onPress={() => onChange(false)}>
          <ThemedText type="small">{noLabel}</ThemedText>
          <View style={[styles.checkbox, value === false && styles.checkboxChecked]} />
        </Pressable>
      </View>
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
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState<OpeningHours>({});
  const [hoursNotApplicable, setHoursNotApplicable] = useState(false);
  const [otherCategoryDetail, setOtherCategoryDetail] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [pinCoords, setPinCoords] = useState<MapCoords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [nearbyExisting, setNearbyExisting] = useState<NearbyLocation[]>([]);
  const [geocodedCity, setGeocodedCity] = useState<string | null>(null);
  const [geocodedCountry, setGeocodedCountry] = useState<string | null>(null);
  const [visibleAsCreator, setVisibleAsCreator] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);
  const [availableSummer, setAvailableSummer] = useState(false);
  const [availableWinter, setAvailableWinter] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [publishDate, setPublishDate] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [claimFailed, setClaimFailed] = useState(false);

  // Submitting is several writes in a row, and the later ones can fail on their
  // own (a photo upload especially). Without this, retrying re-ran the whole
  // sequence and created a second copy of the location every time. Remember
  // what already landed so a retry finishes the job instead of repeating it.
  const createdLocationId = useRef<string | null>(null);
  const uploadedPhotoCount = useRef(0);

  useEffect(() => {
    fetchCategories(supabase)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Go through handlePinChange rather than setting the pin directly, so the
  // opening position is geocoded like any other. It used to only set the pin:
  // anyone who left it where their phone put them submitted with city and
  // country null, because those two are *only* ever filled in by the geocode —
  // there are no fields for them. That silently emptied the city line on every
  // card for locations added without touching the map.
  useEffect(() => {
    if (coords && !pinCoords) {
      handlePinChange(coords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  // Nothing in the schema stops two people adding the same court, which would
  // split its reviews and rating across two listings. We can't reliably detect
  // a duplicate automatically (names vary, one park can hold several courts),
  // so show what's already nearby and let the person decide.
  const checkForNearbyDuplicates = (coords: MapCoords) => {
    fetchNearbyLocations(supabase, {
      lat: coords.latitude,
      lng: coords.longitude,
      radiusM: DUPLICATE_RADIUS_M,
    })
      .then((rows) => setNearbyExisting(rows.slice(0, 5)))
      .catch(() => setNearbyExisting([]));
  };

  const handlePinChange = (next: MapCoords) => {
    setPinCoords(next);
    checkForNearbyDuplicates(next);
    setGeocoding(true);
    Location.reverseGeocodeAsync(next)
      .then((results) => {
        const result = results[0];
        if (result) {
          const streetLine = formatStreetLine(result);
          const cityLine = formatCityLine(result);
          if (streetLine) setAddressLine1(streetLine);
          if (cityLine) setAddressLine2(cityLine);
        }
        setGeocodedCity(result ? resolveCity(result) : null);
        setGeocodedCountry(result?.country ?? null);
      })
      .catch(() => {})
      .finally(() => setGeocoding(false));
  };

  const selectedCategoryLabel = categories
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => c.name)
    .join(', ');
  const hasOtherCategory = categories.some((c) => categoryIds.includes(c.id) && c.slug === 'other');

  // Already-picked categories stay visible while searching, so a narrow query
  // can't hide a selection and make it look like it was lost.
  const trimmedCategoryQuery = categoryQuery.trim().toLowerCase();
  const visibleCategories = trimmedCategoryQuery
    ? categories.filter(
        (c) => c.name.toLowerCase().includes(trimmedCategoryQuery) || categoryIds.includes(c.id)
      )
    : categories;

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]
    );
  };

  const hasPhoto = photoUris.length > 0;
  const emailValid = !isActivity || EMAIL_PATTERN.test(email.trim());
  const otherCategoryValid = !hasOtherCategory || otherCategoryDetail.trim().length > 0;
  let dateError: string | null = null;
  let expiresAtIso: string | null = null;
  let startsAtIso: string | null = null;
  let publishAtIso: string | null = null;

  if (isActivity) {
    startsAtIso = startDate ? startDate.toISOString() : null;

    if (endDate && startDate) {
      if (endDate.getTime() < startDate.getTime()) {
        dateError = 'The end date must be after the start date.';
      } else {
        const daysOut = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysOut > MAX_ACTIVITY_DAYS) {
          dateError = `Activities can only run for up to ${MAX_ACTIVITY_DAYS} days — choose an earlier end date.`;
        } else {
          expiresAtIso = endDate.toISOString();
        }
      }
    }

    if (!dateError && publishDate) {
      if (endDate && publishDate.getTime() > endDate.getTime()) {
        dateError = "The publish date can't be after the end date.";
      } else {
        publishAtIso = publishDate.toISOString();
      }
    }
  }

  const canSubmit =
    Boolean(
      name.trim() &&
        addressLine1.trim() &&
        addressLine2.trim() &&
        categoryIds.length > 0 &&
        hasPhoto &&
        pinCoords &&
        emailValid &&
        otherCategoryValid &&
        visibleAsCreator !== null &&
        isOwner !== null &&
        (!isActivity || (startDate && endDate && !dateError && isPrivate !== null))
    ) && !submitting;

  const handleSubmit = async () => {
    if (!session || !pinCoords || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const address = [addressLine1.trim(), addressLine2.trim()].filter(Boolean).join(', ');
      const locationId =
        createdLocationId.current ??
        (await submitLocation(supabase, {
        kind: isActivity ? 'activity' : 'place',
        name: name.trim(),
        description: description.trim() || null,
        address,
        city: geocodedCity,
        country: geocodedCountry,
        lat: pinCoords.latitude,
        lng: pinCoords.longitude,
        categoryIds,
        userId: session.user.id,
        phone: isActivity ? null : phone.trim() || null,
        website: isActivity ? null : website.trim() || null,
        email: isActivity ? email.trim() : null,
        hours: hoursNotApplicable || Object.keys(hours).length === 0 ? null : hours,
        hoursNotApplicable,
        creatorVisible: visibleAsCreator === true,
        visibility: isActivity && isPrivate === true ? 'private' : 'public',
        startsAt: isActivity ? startsAtIso : null,
        publishAt: isActivity ? publishAtIso : null,
        expiresAt: isActivity ? expiresAtIso : null,
        otherCategoryDetail: hasOtherCategory ? otherCategoryDetail.trim() : null,
        availableSummer,
        availableWinter,
        }));
      createdLocationId.current = locationId;

      // Resume at the photo that failed rather than re-uploading the ones that
      // already went up (which would attach them to the location twice).
      for (let index = uploadedPhotoCount.current; index < photoUris.length; index += 1) {
        const path = `locations/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        await uploadImageToMedia(path, photoUris[index]);
        await addLocationPhoto(supabase, locationId, session.user.id, path);
        uploadedPhotoCount.current = index + 1;
      }

      if (isOwner) {
        // Previously swallowed: the person said they own the place, the claim
        // failed, and they were told everything succeeded. Report it instead —
        // the location itself is already saved, so this isn't fatal.
        try {
          await submitBusinessClaim(supabase, locationId, session.user.id, null);
        } catch (claimError) {
          console.error('Ownership claim failed', claimError);
          setClaimFailed(true);
        }
      }

      setSubmitted(true);
    } catch (err) {
      console.error(`Failed to submit ${noun}`, err);
      setError(
        createdLocationId.current
          ? // Already saved, so a restriction isn't what stopped this — the
            // photos are the only outstanding part.
            `Your ${noun} was saved, but its photos didn't finish uploading. Tap submit again to retry — that won't create a second ${noun}.`
          : await writeFailureMessage(
              session.user.id,
              `Something went wrong submitting your ${noun}. Try again.`
            )
      );
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
              {/* There is no approval queue: the insert policy requires
                  status = 'active', and the read policy shows an active,
                  published location straight away. Saying it was "submitted
                  for review" and would "go live once approved" contradicted
                  both the database and the disclaimer on the form itself, and
                  left people waiting for an email that was never coming. */}
              {publishAtIso
                ? `Your ${noun} is saved and will go live on ${new Date(publishAtIso).toLocaleDateString()}. Moderation happens afterwards — it can be hidden or removed if it turns out to break the rules.`
                : `Your ${noun} is live now. Moderation happens afterwards — it can be hidden or removed if it turns out to break the rules.`}
            </ThemedText>
            {claimFailed && (
              <ThemedText type="small" style={[styles.errorText, styles.centerText]}>
                Your {noun} was saved, but we couldn&apos;t register your ownership claim. Open the {noun} and
                use &ldquo;Claim this business&rdquo; to try again.
              </ThemedText>
            )}
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
            *Mandatory: at least 1 picture
          </ThemedText>

          <PhotoPicker uris={photoUris} onChange={setPhotoUris} />

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

          {nearbyExisting.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.duplicateCard}>
              <View style={styles.duplicateHeader}>
                <Ionicons name="information-circle-outline" size={18} color="#E8A93B" />
                <ThemedText type="smallBold" style={styles.duplicateTitle}>
                  Already on the map here
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                If one of these is the same place, open it and add a review instead — that keeps all the
                ratings and photos together.
              </ThemedText>
              {nearbyExisting.map((existing) => (
                <Pressable
                  key={existing.id}
                  style={styles.duplicateRow}
                  onPress={() => router.push({ pathname: '/location/[id]', params: { id: existing.id } })}>
                  <View style={styles.duplicateRowText}>
                    <ThemedText type="small" numberOfLines={1}>
                      {existing.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {existing.category_label ?? 'Other'} · {Math.round(existing.distance_m)} m away
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </ThemedView>
          )}

          <TextInput
            value={addressLine1}
            onChangeText={setAddressLine1}
            placeholder={geocoding ? 'Looking up address…' : '*Street address'}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput]}
          />

          <TextInput
            value={addressLine2}
            onChangeText={setAddressLine2}
            placeholder={geocoding ? 'Looking up address…' : '*Postal code and city'}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput]}
          />

          <Pressable style={[styles.input, styles.lightInput, styles.categoryInput]} onPress={() => setPickerVisible(true)}>
            <ThemedText type="default" style={[styles.categoryInputText, !selectedCategoryLabel && styles.lightPlaceholderText]} numberOfLines={1}>
              {selectedCategoryLabel || '*Location type/Category'}
            </ThemedText>
            <Ionicons name="chevron-down" size={16} color="#000000" />
          </Pressable>

          {hasOtherCategory && (
            <TextInput
              value={otherCategoryDetail}
              onChangeText={setOtherCategoryDetail}
              placeholder={`*What kind of ${noun} is this?`}
              placeholderTextColor={LIGHT_PLACEHOLDER}
              style={[styles.input, styles.lightInput]}
            />
          )}

          <View style={styles.seasonRow}>
            <ThemedText type="default">When is this {noun} available? (optional)</ThemedText>
            <View style={styles.seasonOptions}>
              <Pressable style={styles.seasonOption} onPress={() => setAvailableSummer((v) => !v)}>
                <View style={[styles.checkbox, availableSummer && styles.checkboxChecked]} />
                <ThemedText type="small">☀ Summer</ThemedText>
              </Pressable>
              <Pressable style={styles.seasonOption} onPress={() => setAvailableWinter((v) => !v)}>
                <View style={[styles.checkbox, availableWinter && styles.checkboxChecked]} />
                <ThemedText type="small">❄ Winter</ThemedText>
              </Pressable>
            </View>
          </View>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Additional information (optional)"
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput, styles.bodyInput]}
            multiline
          />

          <Pressable style={styles.hoursNaRow} onPress={() => setHoursNotApplicable((v) => !v)}>
            <View style={[styles.checkbox, hoursNotApplicable && styles.checkboxChecked]} />
            <ThemedText type="small" style={styles.hoursNaLabel}>
              This {noun} has no set opening hours (e.g. always open, a public property)
            </ThemedText>
          </Pressable>

          {!hoursNotApplicable && <OpeningHoursEditor hours={hours} onChange={setHours} />}

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
                label="*Should this activity be public or private? Private is only visible to people you share it with (e.g. a party or wedding)."
                value={isPrivate}
                onChange={setIsPrivate}
                yesLabel="PRIVATE"
                noLabel="PUBLIC"
              />

              <DateField label="*Start date" value={startDate} onChange={setStartDate} placeholder="When does it start?" />
              <DateField
                label="*End date"
                value={endDate}
                onChange={setEndDate}
                minimumDate={startDate ?? undefined}
                placeholder="When does it end?"
              />
              <DateField
                label="Publish date (optional)"
                value={publishDate}
                onChange={setPublishDate}
                placeholder="Publish immediately once approved"
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.publishHint}>
                Leave the publish date blank to make this activity visible as soon as it's approved — or pick a
                later date to schedule when it should go live.
              </ThemedText>
              {dateError && (
                <ThemedText type="small" style={styles.errorText}>
                  {dateError}
                </ThemedText>
              )}
            </>
          )}

          <YesNoRow
            label="*Do you want to be visible as the creator?"
            value={visibleAsCreator}
            onChange={setVisibleAsCreator}
          />

          <YesNoRow label={`*Are you the owner of the ${noun}?`} value={isOwner} onChange={setIsOwner} />

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

            <View style={[styles.categorySearchBar, { borderColor: theme.backgroundSelected }]}>
              <Ionicons name="search-sharp" size={15} color={theme.textSecondary} />
              <TextInput
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder="Search categories"
                placeholderTextColor={theme.textSecondary}
                style={[styles.categorySearchInput, { color: theme.text }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {categoryQuery.length > 0 && (
                <Pressable onPress={() => setCategoryQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* keyboardShouldPersistTaps, or the first tap only dismisses the
                keyboard and the category the person aimed at is not selected. */}
            <ScrollView keyboardShouldPersistTaps="handled">
              {visibleCategories.length === 0 ? (
                <ThemedText type="default" themeColor="textSecondary" style={styles.modalEmptyText}>
                  No categories match that search.
                </ThemedText>
              ) : (
                visibleCategories.map((category) => (
                  <Pressable key={category.id} style={styles.modalRow} onPress={() => toggleCategory(category.id)}>
                    <ThemedText type="default">{category.name}</ThemedText>
                    <ThemedText type="default">{categoryIds.includes(category.id) ? '✓' : ''}</ThemedText>
                  </Pressable>
                ))
              )}
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
  hoursNaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hoursNaLabel: {
    flex: 1,
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
  seasonRow: {
    gap: Spacing.two,
  },
  seasonOptions: {
    flexDirection: 'row',
    gap: Spacing.five,
  },
  seasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  duplicateCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#E8A93B',
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  duplicateTitle: {
    color: '#E8A93B',
  },
  duplicateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
  },
  duplicateRowText: {
    flex: 1,
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
  publishHint: {
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
  categorySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 15,
  },
  modalEmptyText: {
    paddingVertical: Spacing.three,
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
