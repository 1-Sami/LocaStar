import {
  ALWAYS_OPEN,
  addLocationPhoto,
  fetchCategories,
  fetchLocationById,
  fetchLocationCategoryIds,
  setLocationCategories,
  updateLocation,
  type Category,
  type LocationKind,
  type OpeningHours,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { MapPinPicker, type MapCoords } from '@/components/map-pin-picker';
import { OpeningHoursEditor } from '@/components/opening-hours-editor';
import { PhotoPicker } from '@/components/photo-picker';
import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { YesNoRow } from '@/components/yes-no-row';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { endOfLocalDay, startOfLocalDay } from '@/lib/activity-dates';
import { formatCityLine, formatStreetLine, resolveCity } from '@/lib/address-format';
import { useAuth } from '@/lib/auth-context';
import { locationPhotoPath } from '@/lib/media-path';
import { uploadImageToMedia } from '@/lib/media-upload';
import { useSharedProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';

// Same shape check as the create form — deliberately loose. Anything stricter
// rejects addresses that are perfectly valid.
const EMAIL_PATTERN = /\S+@\S+\.\S+/;

/** The same cap the create form applies, so editing cannot exceed what adding allows. */
const MAX_ACTIVITY_DAYS = 120;

/** Label above a field. The asterisk marks the ones that must not be emptied. */
function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {children}
      {required ? ' *' : ''}
    </ThemedText>
  );
}

export default function EditLocationScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const { session } = useAuth();
  const { isModerator } = useSharedProfile();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pinCoords, setPinCoords] = useState<MapCoords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [addressPinFailed, setAddressPinFailed] = useState(false);
  // Null until the pin actually moves. Sent only then, so simply opening this
  // screen and saving a phone number cannot blank a city that is already right.
  const [geocodedCity, setGeocodedCity] = useState<string | null>(null);
  const [geocodedCountry, setGeocodedCountry] = useState<string | null>(null);
  /*
   * Whether each address line currently holds something the person typed, so
   * the reverse-geocoder can refill the other one without clobbering it.
   *
   * One flag for both fields is what this replaces, and it read "has ever been
   * touched" rather than "holds their words". Clearing the postal code still
   * counted as an edit, so dropping the pin somewhere new left the city line
   * blank for good. Emptying a field clears its flag: there is nothing left to
   * protect, and someone who wipes a line is asking for it to be filled again.
   */
  const addressLine1Edited = useRef(false);
  const addressLine2Edited = useRef(false);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<LocationKind>('place');
  // Only used to work out whether this save will actually be allowed through.
  const [loadFailed, setLoadFailed] = useState(false);
  const [permissions, setPermissions] = useState<{
    createdBy: string | null;
    createdAt: string;
    claimedBy: string | null;
    isVerified: boolean;
  } | null>(null);
  const [hours, setHours] = useState<OpeningHours>({});
  const [availableSummer, setAvailableSummer] = useState(false);
  const [availableWinter, setAvailableWinter] = useState(false);
  const [isFree, setIsFree] = useState<boolean | null>(null);
  /*
   * An event's dates, and whether it is on the public map.
   *
   * All four were set once at creation and then fixed: this screen had no
   * control for any of them, and updateLocation did not send the columns even
   * if it had. Changing your mind meant deleting the event and adding it again.
   */
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [publishDate, setPublishDate] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /*
   * Photos a moderator is adding to this location.
   *
   * Only moderators get this. The bulk import brought in a thousand places with
   * no picture at all — an outdoor gym, a court, a nature reserve — and until
   * now the only way to give one a photo was to be the person who created it,
   * inside a 24-hour window that has long since closed on every imported row.
   *
   * These are additions, not a replacement: existing photos are managed from
   * the location's own gallery, and nothing here removes them.
   */
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  /*
   * How many of them already went up.
   *
   * Saving can fail halfway — the location updates, the third upload times out.
   * Without this, tapping save again re-uploads the first two and attaches them
   * to the location a second time. Same reasoning as the create form.
   */
  const uploadedPhotoCount = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      Promise.all([fetchLocationById(supabase, id), fetchLocationCategoryIds(supabase, id), fetchCategories(supabase)])
        .then(([location, existingCategoryIds, categoriesResult]) => {
          if (cancelled) return;
          setCategories(categoriesResult);
          if (location) {
            setName(location.name);
            setDescription(location.description ?? '');
            setPinCoords({ latitude: location.lat, longitude: location.lng });
            // Stored as one string, joined with ', ' by add-location. Split on
            // the LAST comma so a street containing one ("Torg 1, uppg B")
            // keeps it, and the postcode/city half stays intact.
            const stored = location.address ?? '';
            const cut = stored.lastIndexOf(',');
            setAddressLine1(cut === -1 ? stored : stored.slice(0, cut).trim());
            setAddressLine2(cut === -1 ? '' : stored.slice(cut + 1).trim());
            setWebsite(location.website ?? '');
            setPhone(location.phone ?? '');
            setEmail(location.email ?? '');
            setKind(location.kind);
            setPermissions({
              createdBy: location.created_by,
              createdAt: location.created_at,
              claimedBy: location.claimed_by,
              isVerified: location.is_verified,
            });
            // "This place has no set opening hours" is gone — Open 24/7 says the
            // same thing and says it better. Rows that still carry the old flag
            // open with 24/7 already ticked, so the meaning survives, it is
            // visible before you save, and it can be unticked like any other.
            setHours(location.hours_not_applicable ? ALWAYS_OPEN : (location.hours ?? {}));
            setAvailableSummer(location.available_summer);
            setIsFree(location.is_free);
            setAvailableWinter(location.available_winter);
            setIsPrivate(location.visibility === 'private');
            setStartDate(location.starts_at ? new Date(location.starts_at) : null);
            // Stored as the last instant of the closing day, so it reads back as
            // that day rather than as the one after it.
            setEndDate(location.expires_at ? startOfLocalDay(new Date(location.expires_at)) : null);
            setPublishDate(location.publish_at ? new Date(location.publish_at) : null);
          }
          setCategoryIds(existingCategoryIds);
        })
        .catch((err) => {
          // Every field stays at its initial empty value, so the form claims
          // the place has no name, no address and no hours. canSave already
          // refuses to write that back, but silence left a dead Save button
          // and no reason for it.
          console.error('Failed to load the location to edit', err);
          if (!cancelled) setLoadFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  const selectedCategoryLabel = categories
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => c.name)
    .join(', ');

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((c) => c !== categoryId) : [...current, categoryId]
    );
  };

  /**
   * Moves the pin, and rewrites the address to match where it landed.
   *
   * Only the address-to-pin direction existed here, so dragging the pin left
   * the old address sitting underneath it — the screen would happily save a
   * place whose coordinates and whose written address were in different towns,
   * and the person doing it had no way to tell.
   *
   * Same rule as the create form: an address somebody typed themselves is
   * never overwritten. The difference is that here the field starts full, of
   * the stored address, and replacing *that* is the whole point.
   *
   * There used to be a `keepAddress` parameter for when the pin moved because
   * of the address; the per-field flags cover it, and cover the cleared field
   * that flag could not.
   */
  const handlePinChange = (next: MapCoords) => {
    setPinCoords(next);
    setSaved(false);
    setGeocoding(true);
    Location.reverseGeocodeAsync(next)
      .then((results) => {
        const result = results[0];
        if (result) {
          const streetLine = formatStreetLine(result);
          const cityLine = formatCityLine(result);
          // Per line, so one typed field does not freeze the other. Never
          // clobbers an address someone typed: before the flags existed at
          // all, typing the address and then nudging the pin silently
          // replaced it with whatever the geocoder said about the new spot.
          if (streetLine && !addressLine1Edited.current) setAddressLine1(streetLine);
          if (cityLine && !addressLine2Edited.current) setAddressLine2(cityLine);
        }
        // Captured even when the address is left alone: city and country are
        // never typed, so the geocoder is the only thing that can supply them,
        // and a place dragged to another town kept the old city in the
        // database with nothing on screen admitting it.
        setGeocodedCity(result ? resolveCity(result) : null);
        setGeocodedCountry(result?.country ?? null);
      })
      .catch((err) => {
        // The typed address stays; only the lookup for the moved pin is lost.
        console.error('Reverse geocoding failed', err);
      })
      .finally(() => setGeocoding(false));
  };

  /**
   * Moves the pin to the typed address.
   *
   * Same reasoning as the create form: geom is what locates a place, the
   * address is only text beside it, and nothing connected the two. Here it
   * matters more — this screen exists to correct mistakes, and until now it
   * could fix the words while leaving the place itself in the wrong town.
   */
  const handleAddressBlur = async () => {
    if (!addressLine1Edited.current && !addressLine2Edited.current) return;
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
      // What was typed is protected by its own flag, so the answer cannot
      // overwrite the question; city and country still refresh.
      handlePinChange({ latitude: hit.latitude, longitude: hit.longitude });
    } catch {
      setAddressPinFailed(true);
    } finally {
      setGeocoding(false);
    }
  };

  /**
   * Whether the database will actually accept this save.
   *
   * Worth checking here and not only on the button that got you here, because
   * the guard trigger does not raise on a write it disallows — it silently
   * reverts the columns and reports success, so without this you would be told
   * "Saved." and nothing would have changed.
   *
   * The creator used to fall out of this after 24 hours, which is exactly how
   * that silent revert was reached in normal use. The window is gone at both
   * ends now (migration 0132); what is left is the honest question of whether
   * this row is yours at all.
   */
  const cannotEdit = Boolean(
    permissions &&
      !isModerator &&
      !(session && permissions.isVerified && permissions.claimedBy === session.user.id) &&
      !(session && permissions.createdBy === session.user.id)
  );

  // A name and an address are what make a place findable, so editing must not
  // be a way to empty either. Both address halves are required, matching the
  // create form rather than a single free-text box.
  const missingName = !name.trim();
  // Optional, but has to be an address if given — same rule as the create form.
  const emailValid = kind !== 'activity' || email.trim() === '' || EMAIL_PATTERN.test(email.trim());
  /*
   * The event's dates, checked exactly as the create form checks them.
   *
   * Whole days rather than instants, because the pickers are date-only and two
   * dates tapped as "today" differ only by the seconds between the taps. The
   * ends of the day matter too: an hourly job deletes activities past
   * expires_at, which is how a festival once vanished at 19:12 on its last day.
   */
  const isActivity = kind === 'activity';
  let dateError: string | null = null;
  let startsAtIso: string | null = null;
  let expiresAtIso: string | null = null;
  let publishAtIso: string | undefined;

  if (isActivity) {
    startsAtIso = startDate ? startOfLocalDay(startDate).toISOString() : null;

    if (endDate && startDate) {
      const startDay = startOfLocalDay(startDate).getTime();
      const endDay = startOfLocalDay(endDate).getTime();
      if (endDay < startDay) {
        dateError = t('addLocation.endBeforeStart');
      } else if ((endDay - startDay) / (1000 * 60 * 60 * 24) > MAX_ACTIVITY_DAYS) {
        dateError = t('addLocation.tooLong', { days: MAX_ACTIVITY_DAYS });
      } else {
        expiresAtIso = endOfLocalDay(endDate).toISOString();
      }
    }

    if (!dateError && publishDate) {
      if (endDate && startOfLocalDay(publishDate).getTime() > startOfLocalDay(endDate).getTime()) {
        dateError = t('addLocation.publishAfterEnd');
      } else {
        publishAtIso = startOfLocalDay(publishDate).toISOString();
      }
    }
  }

  const canSave = Boolean(
    !missingName && addressLine1.trim() && addressLine2.trim() && emailValid && !cannotEdit && !dateError
  );

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await updateLocation(supabase, id, {
        name: name.trim(),
        description: description.trim() || null,
        address: [addressLine1.trim(), addressLine2.trim()].filter(Boolean).join(', '),
        lat: pinCoords?.latitude,
        lng: pinCoords?.longitude,
        // Only when the pin moved and the geocoder answered — see the state
        // declaration. Undefined leaves the stored value alone.
        city: geocodedCity ?? undefined,
        country: geocodedCountry ?? undefined,
        website: website.trim() || null,
        // Split by kind, matching the create form: don't start writing a phone
        // number onto an activity, or an email onto a place.
        phone: kind === 'activity' ? undefined : phone.trim() || null,
        email: kind === 'activity' ? email.trim() || null : undefined,
        hours: Object.keys(hours).length === 0 ? null : hours,
        // Always cleared: the flag's one meaning is now carried by 24/7 hours.
        hoursNotApplicable: false,
        availableSummer,
        availableWinter,
        isFree,
        // Events only. Sending these for a place would write dates onto
        // something that has none and take it off the public map.
        visibility: isActivity && isPrivate !== null ? (isPrivate ? 'private' : 'public') : undefined,
        startsAt: isActivity ? startsAtIso : undefined,
        expiresAt: isActivity ? expiresAtIso : undefined,
        publishAt: isActivity ? publishAtIso : undefined,
      });
      await setLocationCategories(supabase, id, categoryIds);

      if (photoUris.length > 0) {
        // location_photos.user_id has to be the caller's own id — the insert
        // policy checks auth.uid() = user_id before it checks is_moderator().
        // Throwing rather than skipping: silently dropping the photos would
        // report a save that did not happen.
        if (!session) throw new Error(t('editLocation.uploadSignedOut'));

        // Resume where a previous attempt stopped rather than starting over, so
        // a retry cannot attach the same picture twice.
        for (let index = uploadedPhotoCount.current; index < photoUris.length; index += 1) {
          const path = locationPhotoPath(id);
          await uploadImageToMedia(path, photoUris[index]);
          await addLocationPhoto(supabase, id, session.user.id, path);
          uploadedPhotoCount.current = index + 1;
        }
        // Attached now, so clear the tray — leaving them selected invites a
        // second save that would add them all again.
        setPhotoUris([]);
        uploadedPhotoCount.current = 0;
      }

      setSaved(true);
    } catch {
      setError(t('editLocation.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ActivityIndicator style={styles.loadingIndicator} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Showing the form would be showing this place as blank. Say what happened
  // instead — the fields are empty because nothing arrived, not because the
  // location is empty.
  if (loadFailed) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.loadFailedText}>
            {t('common.somethingWentWrong')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {cannotEdit && (
            <ThemedText type="small" style={styles.addressWarning}>
              {t('editLocation.notYours')}
            </ThemedText>
          )}

          <View style={styles.field}>
            <FieldLabel required>{t('form.nameLabel')}</FieldLabel>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setSaved(false);
              }}
              placeholder={t('form.namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            />
            {missingName && (
              <ThemedText type="small" style={styles.addressWarning}>
                {t('form.nameRequired')}
              </ThemedText>
            )}
          </View>

          <View style={styles.field}>
            <FieldLabel>{t('form.activity')}</FieldLabel>
            <Pressable
              style={[styles.input, styles.categoryInput, { borderColor: theme.fieldBorder }]}
              onPress={() => setPickerVisible(true)}>
              <ThemedText
                type="default"
                themeColor={selectedCategoryLabel ? undefined : 'textSecondary'}
                numberOfLines={1}
                style={styles.categoryInputText}>
                {selectedCategoryLabel || 'Choose categories (optional)'}
              </ThemedText>
              <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <FieldLabel required>{t('form.street')}</FieldLabel>
            <TextInput
              value={addressLine1}
              onChangeText={(text) => {
                // Emptied means unedited — see the flags' declaration.
                addressLine1Edited.current = text.trim().length > 0;
                setAddressPinFailed(false);
                setAddressLine1(text);
                setSaved(false);
              }}
              onBlur={handleAddressBlur}
              placeholder={t('form.streetPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel required>{t('form.area')}</FieldLabel>
            <TextInput
              value={addressLine2}
              onChangeText={(text) => {
                addressLine2Edited.current = text.trim().length > 0;
                setAddressPinFailed(false);
                setAddressLine2(text);
                setSaved(false);
              }}
              onBlur={handleAddressBlur}
              placeholder={t('form.areaPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            />
          </View>

          {addressPinFailed && (
            <ThemedText type="small" style={styles.addressWarning}>
              {t('editLocation.geocodeFailed')}
            </ThemedText>
          )}

          {/* The pin is the location. Without this the screen could correct an
              address while leaving the place itself pinned in the wrong town,
              which is exactly how a playground in Eskilstuna ended up filed
              eighteen metres from a gym in Norsborg. */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.section}>
            {geocoding ? t('form.lookingUpAddress') : t('form.dragPin')}
          </ThemedText>
          {pinCoords && (
            <View style={styles.mapWrapper}>
              <MapPinPicker
                latitude={pinCoords.latitude}
                longitude={pinCoords.longitude}
                onChange={handlePinChange}
              />
            </View>
          )}

          <View style={styles.field}>
            <FieldLabel>{t('form.description')}</FieldLabel>
            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setSaved(false);
              }}
              placeholder={t('form.descriptionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.bodyInput, { color: theme.text, borderColor: theme.fieldBorder }]}
              multiline
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>{t('form.website')}</FieldLabel>
            <TextInput
              value={website}
              onChangeText={(text) => {
                setWebsite(text);
                setSaved(false);
              }}
              placeholder={t('form.websitePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            />
          </View>

          {/* Contact details split by kind, matching the create form: an
              activity has an organiser to email, a place has a number to ring. */}
          {kind === 'activity' ? (
            <View style={styles.field}>
              <FieldLabel>{t('form.contactEmail')}</FieldLabel>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setSaved(false);
                }}
                placeholder={t('form.contactEmailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
              />
              {!emailValid && (
                <ThemedText type="small" style={styles.addressWarning}>
                  {t('form.emailInvalid')}
                </ThemedText>
              )}
            </View>
          ) : (
            <View style={styles.field}>
              <FieldLabel>{t('form.phone')}</FieldLabel>
              <TextInput
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setSaved(false);
                }}
                placeholder={t('form.phonePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
              />
            </View>
          )}

          <View style={styles.section}>
            <OpeningHoursEditor
              hours={hours}
              onChange={(next) => {
                setHours(next);
                setSaved(false);
              }}
            />
          </View>

          {/* Same row as the add screen — see the note there. */}
          <View style={[styles.seasonRow, styles.section]}>
            <ThemedText type="default">{t('form.placeType')}</ThemedText>
            <View style={styles.typeOptions}>
              <Pressable
                style={[styles.typePill, { borderColor: theme.fieldBorder }, availableSummer && styles.typePillOn]}
                onPress={() => {
                  setAvailableSummer((v) => !v);
                  setSaved(false);
                }}>
                <ThemedText type="small" style={availableSummer ? styles.typePillTextOn : undefined}>
                  {t('search.summer')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.typePill, { borderColor: theme.fieldBorder }, availableWinter && styles.typePillOn]}
                onPress={() => {
                  setAvailableWinter((v) => !v);
                  setSaved(false);
                }}>
                <ThemedText type="small" style={availableWinter ? styles.typePillTextOn : undefined}>
                  {t('search.winter')}
                </ThemedText>
              </Pressable>
              {/* Season and price are different questions, and four bare pills
                  in a row read as one set of four. */}
              <View style={[styles.typeDivider, { backgroundColor: theme.fieldBorder }]} />
              <Pressable
                style={[styles.typePill, { borderColor: theme.fieldBorder }, isFree === true && styles.typePillOn]}
                onPress={() => {
                  setIsFree((v) => (v === true ? null : true));
                  setSaved(false);
                }}>
                <ThemedText type="small" style={isFree === true ? styles.typePillTextOn : undefined}>
                  {t('search.free')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.typePill, { borderColor: theme.fieldBorder }, isFree === false && styles.typePillOn]}
                onPress={() => {
                  setIsFree((v) => (v === false ? null : false));
                  setSaved(false);
                }}>
                <ThemedText type="small" style={isFree === false ? styles.typePillTextOn : undefined}>
                  {t('search.paid')}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/*
            An event's own fields. Set once when it was created and unreachable
            ever after — so a festival that moved a week, or one added privately
            that its organiser then wanted on the map, could only be fixed by
            deleting it and starting again.
          */}
          {isActivity && (
            <View style={styles.section}>
              <YesNoRow
                label={t('addLocation.publicOrPrivate')}
                value={isPrivate}
                onChange={(value) => {
                  setIsPrivate(value);
                  setSaved(false);
                }}
                yesLabel={t('addLocation.private')}
                noLabel={t('addLocation.public')}
              />

              <DateField
                label={t('addLocation.startDate')}
                value={startDate}
                onChange={(value) => {
                  setStartDate(value);
                  setSaved(false);
                }}
                placeholder={t('addLocation.startDatePlaceholder')}
              />
              <DateField
                label={t('addLocation.endDate')}
                value={endDate}
                onChange={(value) => {
                  setEndDate(value);
                  setSaved(false);
                }}
                minimumDate={startDate ?? undefined}
                placeholder={t('addLocation.endDatePlaceholder')}
              />
              <DateField
                label={t('addLocation.publishDate')}
                value={publishDate}
                onChange={(value) => {
                  setPublishDate(value);
                  setSaved(false);
                }}
                placeholder={t('addLocation.publishDatePlaceholder')}
              />

              {dateError && (
                <ThemedText type="small" style={styles.addressWarning}>
                  {dateError}
                </ThemedText>
              )}
            </View>
          )}

          {/*
            Moderators only. Everyone else adds photos when they create a place
            or when they review one — this exists for the thousand imported
            locations that arrived with no picture and no creator left inside
            the edit window to give them one.
          */}
          {isModerator && (
            <View style={styles.section}>
              <ThemedText type="smallBold" style={styles.photoLabel}>
                {t('form.addPhotos')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.photoHint}>
                {t(kind === 'activity' ? 'form.photoHintActivity' : 'form.photoHintPlace')}
              </ThemedText>
              <PhotoPicker
                uris={photoUris}
                onChange={(next) => {
                  setPhotoUris(next);
                  setSaved(false);
                }}
              />
            </View>
          )}

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
          {saved && !error && (
            <ThemedText type="small" style={styles.savedText}>
              {t('editLocation.saved')}
            </ThemedText>
          )}

          <Pressable
            style={[styles.saveButton, (!canSave || submitting) && styles.saveButtonDisabled]}
            disabled={!canSave || submitting}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {submitting ? t('editLocation.saving') : t('editLocation.saveChanges')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <SheetRoot>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {t('form.categories')}
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
              <ThemedText type="smallBold" style={styles.saveButtonText}>
                {t('form.done')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </SheetRoot>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadFailedText: {
    textAlign: 'center',
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  content: {
    padding: Spacing.four,
    // Tight, because each field now carries its own label and a visible box.
    // The old 16 between bare, borderless inputs made four text fields read as
    // four unrelated lines of text.
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  // Breathing room between groups of fields and the blocks that follow them,
  // now that the gap between individual fields is deliberately small.
  section: {
    marginTop: Spacing.two,
  },
  /* borderColor comes from theme.fieldBorder at each use, as on the add form.
     The grey here was visible in both themes but faint against white; the token
     is the one the rest of the form's outlines already use. */
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: Spacing.half,
  },
  checkboxChecked: {
    backgroundColor: '#14747A',
    borderColor: '#14747A',
  },
  seasonRow: {
    gap: Spacing.two,
  },
  typeOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  /* Spacing.two, not three: at three the four pills and their divider came to
     351px against the 342 a 390pt phone has, so "Paid" wrapped onto a line of
     its own. They fit on one line now, and still wrap rather than clip on the
     narrowest phones in Swedish. */
  typePill: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  /* The same teal a ticked checkbox used here before, so the screen did not
     grow a second "chosen" colour when these stopped being checkboxes. */
  typePillOn: {
    backgroundColor: '#14747A',
    borderColor: '#14747A',
  },
  typePillTextOn: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  typeDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: Spacing.one,
  },
  input: {
    // A full point rather than a hairline: the outline is the only thing that
    // says "this is a box you can type in".
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  categoryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    // Matches what a TextInput of the same padding ends up at, so the picker
    // does not sit a few pixels shorter than the fields around it.
    minHeight: 44,
  },
  categoryInputText: {
    flex: 1,
  },
  bodyInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  mapWrapper: {
    height: 220,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  addressWarning: {
    color: '#E8A93B',
  },
  errorText: {
    color: '#E05252',
  },
  savedText: {
    color: '#4CD37A',
  },
  photoLabel: {
    marginBottom: Spacing.one,
  },
  photoHint: {
    marginBottom: Spacing.two,
  },
  saveButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
  },
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
