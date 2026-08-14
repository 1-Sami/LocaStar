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
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { MapPinPicker, type MapCoords } from '@/components/map-pin-picker';
import { OpeningHoursEditor } from '@/components/opening-hours-editor';
import { HeaderBackButton } from '@/components/header-back-button';
import { PhotoPicker } from '@/components/photo-picker';
import { ScreenTitle } from '@/components/screen-title';
import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDiscardWarning } from '@/hooks/use-discard-warning';
import { useUserLocation } from '@/hooks/use-user-location';
import { endOfLocalDay, startOfLocalDay } from '@/lib/activity-dates';
import { formatCityLine, formatStreetLine, resolveCity } from '@/lib/address-format';
import { useAuth } from '@/lib/auth-context';
import { uploadImageToMedia } from '@/lib/media-upload';
import { categoryLabel, categoryLabelFromName } from '@/lib/categories';
import { useSharedProfile } from '@/lib/profile-context';
import { writeFailureMessage } from '@/lib/restriction';
import { supabase } from '@/lib/supabase';

// Roughly a city block. Wide enough to catch the same court pinned slightly
// differently, tight enough not to list every place in the neighbourhood.
const DUPLICATE_RADIUS_M = 200;
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const MAX_ACTIVITY_DAYS = 120;

function YesNoRow({
  label,
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.yesNoRow}>
      <ThemedText type="default">{label}</ThemedText>
      <View style={styles.yesNoOptions}>
        <Pressable style={styles.yesNoOption} onPress={() => onChange(true)}>
          <ThemedText type='small'>{yesLabel ?? t('common.yes')}</ThemedText>
          <View style={[styles.checkbox, value === true && styles.checkboxChecked]} />
        </Pressable>
        <Pressable style={styles.yesNoOption} onPress={() => onChange(false)}>
          <ThemedText type='small'>{noLabel ?? t('common.no')}</ThemedText>
          <View style={[styles.checkbox, value === false && styles.checkboxChecked]} />
        </Pressable>
      </View>
    </View>
  );
}

export default function AddLocationScreen() {
  const { t } = useTranslation();
  const { kind } = useLocalSearchParams<{ kind: LocationKind }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { coords } = useUserLocation();
  const { role } = useSharedProfile();

  // Admins seed places nobody has photographed yet — an imported court, an
  // activity announced before there is anything to shoot. Everyone else still
  // brings a picture: an unphotographed listing from a stranger is the one we
  // can't tell apart from an invented one.
  const isAdmin = role === 'admin';

  const isActivity = kind === 'activity';
  /*
   * Which half of every kind-specific message to use.
   *
   * Sentences mentioning a place or an activity are written out in full for
   * both, rather than dropping a noun into a slot: Swedish attaches the
   * definite article to the noun itself — platsen, aktiviteten — so no single
   * word can be substituted and still leave a grammatical sentence.
   */
  const kindKey = isActivity ? 'activity' : 'place';
  // The icon and colour used to be repeated here alongside the label. They were
  // already in MENU_ICONS under the same two ids, and nothing read the copies.
  const headerKey = isActivity ? 'addActivity' : 'addLocation';

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState<OpeningHours>({});
  const [otherCategoryDetail, setOtherCategoryDetail] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [pinCoords, setPinCoords] = useState<MapCoords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [addressPinFailed, setAddressPinFailed] = useState(false);
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
  /**
   * Has this person actually started, or did the form just fill itself in?
   *
   * Deliberately ignores the pin and both address lines: the pin is set from
   * GPS on open and the address is reverse-geocoded from it, so counting either
   * would pop a "discard?" prompt at someone who opened the screen and
   * immediately changed their mind. Everything below requires a deliberate act.
   */
  const hasStarted =
    photoUris.length > 0 ||
    name.trim().length > 0 ||
    description.trim().length > 0 ||
    categoryIds.length > 0 ||
    website.trim().length > 0 ||
    phone.trim().length > 0 ||
    email.trim().length > 0 ||
    otherCategoryDetail.trim().length > 0 ||
    Object.keys(hours).length > 0 ||
    availableSummer ||
    availableWinter ||
    startDate !== null ||
    endDate !== null ||
    publishDate !== null ||
    visibleAsCreator !== null ||
    isOwner !== null ||
    isPrivate !== null;

  const { onBack } = useDiscardWarning(
    hasStarted,
    t(`addLocation.discardWarning.${kindKey}`)
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [claimFailed, setClaimFailed] = useState(false);

  // True once the person edits either address field themselves, so the
  // reverse-geocoder stops rewriting what they wrote.
  const addressEdited = useRef(false);

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

  /**
   * @param keepAddress leave the typed address alone and take only city and
   * country from the geocoder. Set when the pin moved *because* of the
   * address, so the answer doesn't overwrite the question.
   */
  const handlePinChange = (next: MapCoords, keepAddress = false) => {
    setPinCoords(next);
    checkForNearbyDuplicates(next);
    setGeocoding(true);
    Location.reverseGeocodeAsync(next)
      .then((results) => {
        const result = results[0];
        // Never clobber an address someone typed themselves. Before this,
        // typing the address and then nudging the pin silently replaced it
        // with whatever the geocoder said about the new spot.
        if (result && !keepAddress && !addressEdited.current) {
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

  /**
   * Moves the pin to the address that was typed.
   *
   * The pin is what actually locates a place — geom drives every distance
   * search and the map — while the address is only text beside it. Leave the
   * pin where the phone happened to be and type an address 70km away, and the
   * place is recorded at your feet: a playground in Eskilstuna filed 18 metres
   * from a gym in Norsborg, showing as "10 m away" to everyone nearby. The
   * Directions button still worked, because that one uses the address, which
   * is exactly why the mistake is invisible until someone searches.
   *
   * Runs on blur rather than per keystroke — a half-typed street geocodes to
   * the wrong place, and the geocoder is a network call.
   */
  const handleAddressBlur = async () => {
    if (!addressEdited.current) return;
    const query = [addressLine1.trim(), addressLine2.trim()].filter(Boolean).join(', ');
    if (!query) return;

    setGeocoding(true);
    setAddressPinFailed(false);
    try {
      const [hit] = await Location.geocodeAsync(query);
      if (!hit) {
        setAddressPinFailed(true);
        return;
      }
      handlePinChange({ latitude: hit.latitude, longitude: hit.longitude }, true);
    } catch {
      setAddressPinFailed(true);
    } finally {
      setGeocoding(false);
    }
  };

  const selectedCategoryLabel = categories
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => categoryLabel(t, c.slug, c.name))
    .join(', ');
  const hasOtherCategory = categories.some((c) => categoryIds.includes(c.id) && c.slug === 'other');

  // Already-picked categories stay visible while searching, so a narrow query
  // can't hide a selection and make it look like it was lost.
  const trimmedCategoryQuery = categoryQuery.trim().toLowerCase();
  const visibleCategories = trimmedCategoryQuery
    ? categories.filter(
        (c) =>
          categoryLabel(t, c.slug, c.name).toLowerCase().includes(trimmedCategoryQuery) ||
          categoryIds.includes(c.id)
      )
    : categories;

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]
    );
  };

  const hasPhoto = photoUris.length > 0;
  // Optional, but has to be an address if given: a contact nobody can reach is
  // worse than no contact at all.
  const emailValid = !isActivity || email.trim() === '' || EMAIL_PATTERN.test(email.trim());
  const otherCategoryValid = !hasOtherCategory || otherCategoryDetail.trim().length > 0;
  let dateError: string | null = null;
  let expiresAtIso: string | null = null;
  let startsAtIso: string | null = null;
  let publishAtIso: string | null = null;

  if (isActivity) {
    // Pinned to the edges of the chosen day. The pickers are date-only, so the
    // time of day a raw Date carries is whatever the clock said while the form
    // was open — and an hourly cron deletes activities past expires_at, which
    // is how a festival disappeared at 19:12 on its last day. See lib/activity-dates.
    startsAtIso = startDate ? startOfLocalDay(startDate).toISOString() : null;

    if (endDate && startDate) {
      // Compared as whole days for the same reason: two dates picked as "today"
      // and "today" differ only by the seconds between the two taps.
      const startDay = startOfLocalDay(startDate).getTime();
      const endDay = startOfLocalDay(endDate).getTime();
      if (endDay < startDay) {
        dateError = t('addLocation.endBeforeStart');
      } else {
        const daysOut = (endDay - startDay) / (1000 * 60 * 60 * 24);
        if (daysOut > MAX_ACTIVITY_DAYS) {
          dateError = t('addLocation.tooLong', { days: MAX_ACTIVITY_DAYS });
        } else {
          expiresAtIso = endOfLocalDay(endDate).toISOString();
        }
      }
    }

    if (!dateError && publishDate) {
      if (endDate && startOfLocalDay(publishDate).getTime() > startOfLocalDay(endDate).getTime()) {
        dateError = t('addLocation.publishAfterEnd');
      } else {
        // Start of day: publishing should happen from the beginning of the
        // chosen date, not from whenever the form happened to be open.
        publishAtIso = startOfLocalDay(publishDate).toISOString();
      }
    }
  }

  const canSubmit =
    Boolean(
      name.trim() &&
        addressLine1.trim() &&
        addressLine2.trim() &&
        categoryIds.length > 0 &&
        (hasPhoto || isAdmin) &&
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
        website: website.trim() || null,
        email: isActivity ? email.trim() || null : null,
        hours: Object.keys(hours).length === 0 ? null : hours,
        hoursNotApplicable: false,
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
      console.error(`Failed to submit ${kindKey}`, err);
      setError(
        createdLocationId.current
          ? // Already saved, so a restriction isn't what stopped this — the
            // photos are the only outstanding part.
            t(`addLocation.photoRetry.${kindKey}`)
          : await writeFailureMessage(
              session.user.id,
              t(`addLocation.submitError.${kindKey}`),
              t
            )
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen
        options={{
          headerTitle: () => <ScreenTitle titleKey={headerKey} />,
          headerLeft: () => <HeaderBackButton onPress={onBack} />,
          // A half-filled form should not be dismissable by a stray swipe.
          gestureEnabled: !hasStarted,
        }}
      />
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.confirmation}>
            <ThemedText type="subtitle" style={styles.confirmationTitle}>
              {t('addLocation.thanks')}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              {/* There is no approval queue: the insert policy requires
                  status = 'active', and the read policy shows an active,
                  published location straight away. Saying it was "submitted
                  for review" and would "go live once approved" contradicted
                  both the database and the disclaimer on the form itself, and
                  left people waiting for an email that was never coming. */}
              {publishAtIso
                ? t(`addLocation.scheduled.${kindKey}`, { date: new Date(publishAtIso).toLocaleDateString() })
                : t(`addLocation.liveNow.${kindKey}`)}
            </ThemedText>
            {claimFailed && (
              <ThemedText type="small" style={[styles.errorText, styles.centerText]}>
                {t(`addLocation.claimFailed.${kindKey}`)}
              </ThemedText>
            )}
            <Pressable style={styles.submitButton} onPress={() => router.back()}>
              <ThemedText type="smallBold" style={styles.submitButtonText}>
                {t('form.done')}
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <ScreenTitle titleKey={headerKey} />,
          headerLeft: () => <HeaderBackButton onPress={onBack} />,
          // A half-filled form should not be dismissable by a stray swipe.
          gestureEnabled: !hasStarted,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" style={styles.photoLabel}>
            {isAdmin ? t('form.picturesAdmin') : t('form.picturesRequired')}
          </ThemedText>
          {/* Above the picker, not below it: after the photo is chosen is too
              late to be told what may not be chosen. */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.photoRights}>
            {t('common.photoRights')}
          </ThemedText>

          <PhotoPicker uris={photoUris} onChange={setPhotoUris} />

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={isActivity ? t('form.nameOfActivity') : t('form.nameOfLocation')}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput]}
          />

          <ThemedText type="smallBold" style={styles.mapLabel}>
            {t('form.pinExact')}
          </ThemedText>
          {pinCoords ? (
            <MapPinPicker
              latitude={pinCoords.latitude}
              longitude={pinCoords.longitude}
              onChange={handlePinChange}
            />
          ) : (
            <View style={styles.mapLoading}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('form.findingLocation')}
              </ThemedText>
            </View>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {t(`addLocation.tapDragPin.${kindKey}`)}
          </ThemedText>

          {nearbyExisting.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.duplicateCard}>
              <View style={styles.duplicateHeader}>
                <Ionicons name="information-circle-outline" size={18} color="#E8A93B" />
                <ThemedText type="smallBold" style={styles.duplicateTitle}>
                  {t('addLocation.alreadyHere')}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {t('addLocation.alreadyHereBody')}
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
                      {existing.category_label
                        ? categoryLabelFromName(t, existing.category_label)
                        : t('form.otherCategory')}{' '}
                      ·{' '}
                      {t('addLocation.metresAway', { metres: Math.round(existing.distance_m) })}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </ThemedView>
          )}

          <TextInput
            value={addressLine1}
            onChangeText={(text) => {
              addressEdited.current = true;
              setAddressPinFailed(false);
              setAddressLine1(text);
            }}
            onBlur={handleAddressBlur}
            placeholder={geocoding ? 'Looking up address…' : '*Street address'}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput]}
          />

          <TextInput
            value={addressLine2}
            onChangeText={(text) => {
              addressEdited.current = true;
              setAddressPinFailed(false);
              setAddressLine2(text);
            }}
            onBlur={handleAddressBlur}
            placeholder={geocoding ? 'Looking up address…' : '*Postal code and city'}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput]}
          />

          {/* Silence here would be the dangerous outcome: the pin stays where
              the phone is, the place is saved at your feet, and nothing looks
              wrong until someone searches nearby and finds it. */}
          {addressPinFailed && (
            <ThemedText type="small" style={styles.addressWarning}>
              {t('addLocation.geocodeFailed')}
            </ThemedText>
          )}

          <Pressable style={[styles.input, styles.lightInput, styles.categoryInput]} onPress={() => setPickerVisible(true)}>
            <ThemedText type="default" style={[styles.categoryInputText, !selectedCategoryLabel && styles.lightPlaceholderText]} numberOfLines={1}>
              {selectedCategoryLabel || t('form.categoryPlaceholder')}
            </ThemedText>
            <Ionicons name="chevron-down" size={16} color="#000000" />
          </Pressable>

          {hasOtherCategory && (
            <TextInput
              value={otherCategoryDetail}
              onChangeText={setOtherCategoryDetail}
              placeholder={t(`addLocation.whatKind.${kindKey}`)}
              placeholderTextColor={LIGHT_PLACEHOLDER}
              style={[styles.input, styles.lightInput]}
            />
          )}

          <View style={styles.seasonRow}>
            <ThemedText type="default">{t(`addLocation.whenAvailable.${kindKey}`)}</ThemedText>
            <View style={styles.seasonOptions}>
              <Pressable style={styles.seasonOption} onPress={() => setAvailableSummer((v) => !v)}>
                <View style={[styles.checkbox, availableSummer && styles.checkboxChecked]} />
                <ThemedText type="small">☀ {t('search.summer')}</ThemedText>
              </Pressable>
              <Pressable style={styles.seasonOption} onPress={() => setAvailableWinter((v) => !v)}>
                <View style={[styles.checkbox, availableWinter && styles.checkboxChecked]} />
                <ThemedText type="small">❄ {t('search.winter')}</ThemedText>
              </Pressable>
            </View>
          </View>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('form.additionalInfo')}
            placeholderTextColor={LIGHT_PLACEHOLDER}
            style={[styles.input, styles.lightInput, styles.bodyInput]}
            multiline
          />

          {/* "This place has no set opening hours" used to sit here. Open 24/7
              inside the editor covers the same case and covers it better: it
              says the place *is* open rather than that nobody filled the hours
              in, and it produces real hours the app can answer "open now?"
              with. Removed here as well as on the edit screen, so the create
              form cannot keep minting rows that the edit screen then rewrites. */}
          <OpeningHoursEditor hours={hours} onChange={setHours} />

          {isActivity ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('form.contactEmailPlaceholder')}
                placeholderTextColor={LIGHT_PLACEHOLDER}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, styles.lightInput]}
              />
              {/* The address being unusable already disabled Submit, but
                  silently — the button greyed out and nothing said which of a
                  dozen fields was at fault, on a form long enough that the
                  email is off screen by the time you reach the button. The
                  edit screen has said this all along. */}
              {!emailValid && (
                <ThemedText type="small" style={styles.addressWarning}>
                  {t('form.emailInvalid')}
                </ThemedText>
              )}
              {/* An activity has a page to point at as often as a place does —
                  a festival's line-up, a ticket link. The field was simply
                  never offered here. */}
              <TextInput
                value={website}
                onChangeText={setWebsite}
                placeholder={t('form.websitePlaceholder')}
                placeholderTextColor={LIGHT_PLACEHOLDER}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, styles.lightInput]}
              />
            </>
          ) : (
            <>
              <TextInput
                value={website}
                onChangeText={setWebsite}
                placeholder={t('form.websitePlaceholder')}
                placeholderTextColor={LIGHT_PLACEHOLDER}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, styles.lightInput]}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={t('form.phonePlaceholder')}
                placeholderTextColor={LIGHT_PLACEHOLDER}
                keyboardType="phone-pad"
                style={[styles.input, styles.lightInput]}
              />
            </>
          )}

          {isActivity && (
            <>
              <YesNoRow
                label={t('addLocation.publicOrPrivate')}
                value={isPrivate}
                onChange={setIsPrivate}
                yesLabel={t('addLocation.private')}
                noLabel={t('addLocation.public')}
              />

              <DateField label={t('addLocation.startDate')} value={startDate} onChange={setStartDate} placeholder={t('addLocation.startDatePlaceholder')} />
              <DateField
                label={t('addLocation.endDate')}
                value={endDate}
                onChange={setEndDate}
                minimumDate={startDate ?? undefined}
                placeholder={t('addLocation.endDatePlaceholder')}
              />
              <DateField
                label={t('addLocation.publishDate')}
                value={publishDate}
                onChange={setPublishDate}
                placeholder={t('addLocation.publishDatePlaceholder')}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.publishHint}>
                {t('addLocation.publishDateHint')}
              </ThemedText>
              {dateError && (
                <ThemedText type="small" style={styles.errorText}>
                  {dateError}
                </ThemedText>
              )}
            </>
          )}

          <YesNoRow
            label={t('addLocation.visibleAsCreator')}
            value={visibleAsCreator}
            onChange={setVisibleAsCreator}
          />

          <YesNoRow label={t(`addLocation.areYouOwner.${kindKey}`)} value={isOwner} onChange={setIsOwner} />

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
              {submitting ? t('addLocation.submitting') : t(`addLocation.submitButton.${kindKey}`)}
            </ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
            {isActivity ? t('addLocation.disclaimerActivity') : t('addLocation.disclaimerPlace')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <SheetRoot>
          {/* Backdrop as a sibling, not a wrapper: wrapping the sheet meant a
              tap on any dead space inside it also dismissed the picker. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {t('form.categories')}
            </ThemedText>

            <View style={[styles.categorySearchBar, { borderColor: theme.backgroundSelected }]}>
              <Ionicons name="search-sharp" size={15} color={theme.textSecondary} />
              <TextInput
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder={t('form.searchCategories')}
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
                  {t('form.noCategoriesMatch')}
                </ThemedText>
              ) : (
                visibleCategories.map((category) => {
                  const picked = categoryIds.includes(category.id);
                  return (
                    <Pressable
                      key={category.id}
                      style={[
                        styles.modalRow,
                        picked && { backgroundColor: `${theme.primary}26`, borderLeftColor: theme.primary },
                        picked && styles.modalRowActive,
                      ]}
                      onPress={() => toggleCategory(category.id)}>
                      <ThemedText type={picked ? 'smallBold' : 'default'}>
                        {categoryLabel(t, category.slug, category.name)}
                      </ThemedText>
                      <ThemedText type="default">{picked ? '✓' : ''}</ThemedText>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable style={styles.doneButton} onPress={() => setPickerVisible(false)}>
              <ThemedText type="smallBold" style={styles.submitButtonText}>
                {t('form.done')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </SheetRoot>
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
  photoRights: {
    marginTop: -Spacing.two,
    marginBottom: Spacing.one,
    lineHeight: 17,
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
  addressWarning: {
    color: '#E8A93B',
    marginTop: -Spacing.one,
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
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
  },
  /* Same reasoning as the Search filter: the tick is under your thumb. */
  modalRowActive: {
    borderLeftWidth: 3,
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
