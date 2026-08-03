import {
  ALWAYS_OPEN,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapPinPicker, type MapCoords } from '@/components/map-pin-picker';
import { OpeningHoursEditor } from '@/components/opening-hours-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pinCoords, setPinCoords] = useState<MapCoords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [addressPinFailed, setAddressPinFailed] = useState(false);
  const addressEdited = useRef(false);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<LocationKind>('place');
  const [hours, setHours] = useState<OpeningHours>({});
  const [availableSummer, setAvailableSummer] = useState(false);
  const [availableWinter, setAvailableWinter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);
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
            setKind(location.kind);
            // "This place has no set opening hours" is gone — Open 24/7 says the
            // same thing and says it better. Rows that still carry the old flag
            // open with 24/7 already ticked, so the meaning survives, it is
            // visible before you save, and it can be unticked like any other.
            setHours(location.hours_not_applicable ? ALWAYS_OPEN : (location.hours ?? {}));
            setAvailableSummer(location.available_summer);
            setAvailableWinter(location.available_winter);
          }
          setCategoryIds(existingCategoryIds);
        })
        .catch(() => {})
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

  const handlePinChange = (next: MapCoords) => {
    setPinCoords(next);
    setSaved(false);
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
      setPinCoords({ latitude: hit.latitude, longitude: hit.longitude });
      setSaved(false);
    } catch {
      setAddressPinFailed(true);
    } finally {
      setGeocoding(false);
    }
  };

  // A name and an address are what make a place findable, so editing must not
  // be a way to empty either. Both address halves are required, matching the
  // create form rather than a single free-text box.
  const missingName = !name.trim();
  const canSave = Boolean(!missingName && addressLine1.trim() && addressLine2.trim());

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
        // Activities never collected these, so don't start writing them here.
        website: kind === 'activity' ? undefined : website.trim() || null,
        phone: kind === 'activity' ? undefined : phone.trim() || null,
        hours: Object.keys(hours).length === 0 ? null : hours,
        // Always cleared: the flag's one meaning is now carried by 24/7 hours.
        hoursNotApplicable: false,
        availableSummer,
        availableWinter,
      });
      await setLocationCategories(supabase, id, categoryIds);
      setSaved(true);
    } catch {
      setError('Something went wrong saving your changes. Try again.');
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.field}>
            <FieldLabel required>Name/Title</FieldLabel>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setSaved(false);
              }}
              placeholder="Name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            />
            {missingName && (
              <ThemedText type="small" style={styles.addressWarning}>
                A name is required — this is what people see and search for.
              </ThemedText>
            )}
          </View>

          <View style={styles.field}>
            <FieldLabel>Activity</FieldLabel>
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
            <FieldLabel required>Street</FieldLabel>
            <TextInput
              value={addressLine1}
              onChangeText={(text) => {
                addressEdited.current = true;
                setAddressPinFailed(false);
                setAddressLine1(text);
                setSaved(false);
              }}
              onBlur={handleAddressBlur}
              placeholder="Street name and number"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel required>Area</FieldLabel>
            <TextInput
              value={addressLine2}
              onChangeText={(text) => {
                addressEdited.current = true;
                setAddressPinFailed(false);
                setAddressLine2(text);
                setSaved(false);
              }}
              onBlur={handleAddressBlur}
              placeholder="Post code and city"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            />
          </View>

          {addressPinFailed && (
            <ThemedText type="small" style={styles.addressWarning}>
              We couldn&apos;t find that address on the map, so the pin hasn&apos;t moved. Drag it to
              the right spot instead — the pin is what decides where this place is.
            </ThemedText>
          )}

          {/* The pin is the location. Without this the screen could correct an
              address while leaving the place itself pinned in the wrong town,
              which is exactly how a playground in Eskilstuna ended up filed
              eighteen metres from a gym in Norsborg. */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.section}>
            {geocoding ? 'Looking up address…' : 'Drag the pin if it is in the wrong spot.'}
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
            <FieldLabel>Description</FieldLabel>
            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setSaved(false);
              }}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.bodyInput, { color: theme.text, borderColor: theme.fieldBorder }]}
              multiline
            />
          </View>

          {/* Activities never collect these, matching the create form. */}
          {kind !== 'activity' && (
            <>
              <View style={styles.field}>
                <FieldLabel>Website</FieldLabel>
                <TextInput
                  value={website}
                  onChangeText={(text) => {
                    setWebsite(text);
                    setSaved(false);
                  }}
                  placeholder="Website (optional)"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
                />
              </View>

              <View style={styles.field}>
                <FieldLabel>Phone number</FieldLabel>
                <TextInput
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setSaved(false);
                  }}
                  placeholder="Phone number (optional)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
                />
              </View>
            </>
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

          <View style={[styles.seasonRow, styles.section]}>
            <ThemedText type="default">When to visit the location. (Optional)</ThemedText>
            <View style={styles.seasonOptions}>
              <Pressable
                style={styles.seasonOption}
                onPress={() => {
                  setAvailableSummer((v) => !v);
                  setSaved(false);
                }}>
                <View style={[styles.checkbox, availableSummer && styles.checkboxChecked]} />
                <ThemedText type="small">☀ Summer</ThemedText>
              </Pressable>
              <Pressable
                style={styles.seasonOption}
                onPress={() => {
                  setAvailableWinter((v) => !v);
                  setSaved(false);
                }}>
                <View style={[styles.checkbox, availableWinter && styles.checkboxChecked]} />
                <ThemedText type="small">❄ Winter</ThemedText>
              </Pressable>
            </View>
          </View>

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
          {saved && !error && (
            <ThemedText type="small" style={styles.savedText}>
              Saved.
            </ThemedText>
          )}

          <Pressable
            style={[styles.saveButton, (!canSave || submitting) && styles.saveButtonDisabled]}
            disabled={!canSave || submitting}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {submitting ? 'Saving…' : 'Save changes'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
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
              <ThemedText type="smallBold" style={styles.saveButtonText}>
                Done
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
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
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.5)',
    borderRadius: Spacing.half,
  },
  checkboxChecked: {
    backgroundColor: '#14747A',
    borderColor: '#14747A',
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
  modalRoot: {
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
