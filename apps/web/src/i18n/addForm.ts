/*
 * Everything the add form says, in both languages.
 *
 * Its own file for the reason featureList.ts is: sixty-odd strings for one
 * page, which as flat keys in ui.ts would bury the rest of the site's labels.
 * Wording follows the app's add screen wherever the app already says it, so a
 * person who has used one recognises the other.
 */

export interface AddFormCopy {
  // choosing what to add
  whatAreYouAdding: string;
  // photos
  photos: string;
  photosHint: string;
  photosRule: string;
  // basics
  name: string;
  namePlace: string;
  nameEvent: string;
  kindPlace: string;
  kindEvent: string;
  chooseOne: string;
  otherDetail: string;
  // location
  where: string;
  modeAddress: string;
  modeCoords: string;
  street: string;
  area: string;
  coords: string;
  coordsHint: string;
  addressHint: string;
  check: string;
  checking: string;
  pinnedAt: string;
  pinnedAtCoords: string;
  nearbyTitle: string;
  nearbyBody: string;
  metresAway: string;
  // lookup errors
  errNotFound: string;
  errImprecise: string;
  errBadCoords: string;
  errOutside: string;
  errSwapped: string;
  errLookupFailed: string;
  // type
  typeLabel: string;
  summer: string;
  winter: string;
  free: string;
  paid: string;
  // details
  description: string;
  hours: string;
  hoursHint: string;
  open247: string;
  opens: string;
  closes: string;
  days: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', string>;
  website: string;
  phone: string;
  email: string;
  // events
  startDate: string;
  endDate: string;
  publishDate: string;
  publishHint: string;
  visibility: string;
  public: string;
  private: string;
  privateHint: string;
  // who
  showCreator: string;
  isOwnerPlace: string;
  isOwnerEvent: string;
  yes: string;
  no: string;
  // submit
  submitPlace: string;
  submitEvent: string;
  submitting: string;
  disclaimer: string;
  // form errors
  errName: string;
  errCategory: string;
  errOtherDetail: string;
  errLocation: string;
  errPhoto: string;
  errPhotoType: string;
  errPhotoSize: string;
  errTooManyPhotos: string;
  errDatesRequired: string;
  errEndBeforeStart: string;
  errTooLong: string;
  errPublishAfterEnd: string;
  errChoose: string;
  errEmail: string;
  errSubmit: string;
  errRestricted: string;
  errRestrictedUntil: string;
  repickPhotos: string;
  // after
  addedAddress: string;
  addedCoords: string;
  addedPhotosFailed: string;
  addedClaimFailed: string;
  addedPrivate: string;
  addedScheduled: string;
  signInToAdd: string;
}

export const ADD_FORM: Record<'en' | 'sv', AddFormCopy> = {
  en: {
    whatAreYouAdding: 'What are you adding?',
    photos: 'Photos',
    photosHint: 'At least one. The first is the one people see in search results.',
    photosRule: 'Only photos you took yourself, or have the right to use — no screenshots from Google Maps or other websites.',
    name: 'Name',
    namePlace: 'What is it called?',
    nameEvent: 'What is the event called?',
    kindPlace: 'What kind of place is this?',
    kindEvent: 'What kind of event is this?',
    chooseOne: 'Choose one',
    otherDetail: 'What is it?',
    where: 'Where is it?',
    modeAddress: 'Address',
    modeCoords: 'Coordinates',
    street: 'Street address',
    area: 'Postal code and town',
    coords: 'Coordinates',
    coordsHint: 'Most precise for a court, trail or beach with no address of its own. In Google Maps, press and hold the exact spot and copy the two numbers that appear.',
    addressHint: 'The pin goes where the address is. For somewhere in the middle of a park or a forest, coordinates are more exact — or move the pin in the app afterwards.',
    check: 'Check location',
    checking: 'Checking…',
    pinnedAt: 'The pin goes here:',
    pinnedAtCoords: 'At these coordinates, near:',
    nearbyTitle: 'Already on the map near here',
    nearbyBody: 'If one of these is the same place, open it and add a review instead — that keeps its reviews in one place.',
    metresAway: '{m} m away',
    errNotFound: 'We couldn’t find that address. Check the street name and postal code — or use coordinates for an exact spot.',
    errImprecise: 'We found the town, but not that street. Check the spelling — or use coordinates.',
    errBadCoords: 'Those don’t look like coordinates. Write them like this: 59.32932, 18.06858',
    errOutside: 'Those coordinates are outside Sweden.',
    errSwapped: 'Those coordinates are outside Sweden — are they the wrong way round? Try {suggestion}',
    errLookupFailed: 'The address lookup isn’t answering right now. Try again in a moment — or use coordinates.',
    typeLabel: 'Type (optional)',
    summer: 'Summer',
    winter: 'Winter',
    free: 'Free',
    paid: 'Paid',
    description: 'Description (optional)',
    hours: 'Opening hours (optional)',
    hoursHint: 'Leave a day empty if it is closed or you don’t know.',
    open247: 'Open 24/7',
    opens: 'Opens',
    closes: 'Closes',
    days: { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' },
    website: 'Website (optional)',
    phone: 'Phone number (optional)',
    email: 'Contact email (optional)',
    startDate: 'Start date',
    endDate: 'End date',
    publishDate: 'Publish date (optional)',
    publishHint: 'Leave it empty to publish straight away.',
    visibility: 'Public or private?',
    public: 'Public',
    private: 'Private',
    privateHint: 'Private is only visible to the people you share it with.',
    showCreator: 'Show your username as the one who added it?',
    isOwnerPlace: 'Are you the owner of the place?',
    isOwnerEvent: 'Are you the organiser of the event?',
    yes: 'Yes',
    no: 'No',
    submitPlace: 'Submit place',
    submitEvent: 'Submit event',
    submitting: 'Submitting…',
    disclaimer: 'What you add is live as soon as you submit it, and moderated afterwards. Anyone can report something misleading, unlawful or in the wrong place, and it can be hidden or removed. Repeated invalid submissions get an account blocked from adding.',
    errName: 'Give it a name — it is what people see and search for.',
    errCategory: 'Choose what kind it is.',
    errOtherDetail: 'Say what it is, since it is “Other”.',
    errLocation: 'Fill in the address, or the coordinates.',
    errPhoto: 'Add at least one photo.',
    errPhotoType: 'Photos have to be JPEG, PNG or WebP.',
    errPhotoSize: 'One of the photos is larger than 8 MB.',
    errTooManyPhotos: 'Six photos at most.',
    errDatesRequired: 'An event needs a start date and an end date.',
    errEndBeforeStart: 'The end date must be after the start date.',
    errTooLong: 'Events can run for up to 120 days — choose an earlier end date.',
    errPublishAfterEnd: 'The publish date can’t be after the end date.',
    errChoose: 'Answer the questions marked with a star.',
    errEmail: 'That doesn’t look like an email address. Leave it empty if you’d rather not give one.',
    errSubmit: 'Something went wrong saving it. Try again.',
    errRestricted: 'Your account is restricted, so you can’t add places or events right now.',
    errRestrictedUntil: 'Your account is restricted until {date}, so you can’t add places or events until then.',
    repickPhotos: 'Choose your photos again — a browser doesn’t keep them after the page reloads.',
    addedAddress: 'It’s live. The pin was placed from the address — open it in the app to move the pin to the exact spot, any time.',
    addedCoords: 'It’s live, pinned at the coordinates you gave.',
    addedPhotosFailed: 'It’s saved, but the photos didn’t finish uploading. Add them from the app.',
    addedClaimFailed: 'It’s saved, but your ownership claim didn’t go through. Claim it from the app.',
    addedPrivate: 'Your event is saved. It’s private, so it isn’t on the map — share it from the app with the people you’re inviting.',
    addedScheduled: 'Saved. It goes on the map on {date}.',
    signInToAdd: 'Sign in to add a place or an event. It is free, and it takes a minute.',
  },

  sv: {
    whatAreYouAdding: 'Vad lägger du till?',
    photos: 'Foton',
    photosHint: 'Minst ett. Det första är det som syns i sökresultaten.',
    photosRule: 'Bara foton du tagit själv eller har rätt att använda — inga skärmdumpar från Google Maps eller andra webbplatser.',
    name: 'Namn',
    namePlace: 'Vad heter platsen?',
    nameEvent: 'Vad heter evenemanget?',
    kindPlace: 'Vilken sorts plats är det?',
    kindEvent: 'Vilken sorts evenemang är det?',
    chooseOne: 'Välj en',
    otherDetail: 'Vad är det?',
    where: 'Var ligger det?',
    modeAddress: 'Adress',
    modeCoords: 'Koordinater',
    street: 'Gatuadress',
    area: 'Postnummer och ort',
    coords: 'Koordinater',
    coordsHint: 'Mest exakt för en plan, ett spår eller en strand utan egen adress. I Google Maps: håll fingret på exakt rätt ställe och kopiera de två siffrorna som visas.',
    addressHint: 'Nålen hamnar där adressen är. För något mitt i en park eller skog är koordinater mer exakta — eller flytta nålen i appen efteråt.',
    check: 'Kontrollera plats',
    checking: 'Kontrollerar…',
    pinnedAt: 'Nålen hamnar här:',
    pinnedAtCoords: 'Vid koordinaterna, nära:',
    nearbyTitle: 'Redan på kartan i närheten',
    nearbyBody: 'Om någon av dem är samma plats, öppna den och skriv ett omdöme i stället — då hamnar alla omdömen på ett ställe.',
    metresAway: '{m} m bort',
    errNotFound: 'Vi hittade inte adressen. Kontrollera gatunamn och postnummer — eller använd koordinater för en exakt plats.',
    errImprecise: 'Vi hittade orten men inte gatan. Kontrollera stavningen — eller använd koordinater.',
    errBadCoords: 'Det ser inte ut som koordinater. Skriv dem så här: 59.32932, 18.06858',
    errOutside: 'Koordinaterna ligger utanför Sverige.',
    errSwapped: 'Koordinaterna ligger utanför Sverige — är de omkastade? Prova {suggestion}',
    errLookupFailed: 'Adressökningen svarar inte just nu. Försök igen om en stund — eller använd koordinater.',
    typeLabel: 'Typ (valfritt)',
    summer: 'Sommar',
    winter: 'Vinter',
    free: 'Gratis',
    paid: 'Avgift',
    description: 'Beskrivning (valfritt)',
    hours: 'Öppettider (valfritt)',
    hoursHint: 'Lämna en dag tom om det är stängt eller om du inte vet.',
    open247: 'Öppet dygnet runt',
    opens: 'Öppnar',
    closes: 'Stänger',
    days: { mon: 'Måndag', tue: 'Tisdag', wed: 'Onsdag', thu: 'Torsdag', fri: 'Fredag', sat: 'Lördag', sun: 'Söndag' },
    website: 'Webbplats (valfritt)',
    phone: 'Telefonnummer (valfritt)',
    email: 'Kontaktmejl (valfritt)',
    startDate: 'Startdatum',
    endDate: 'Slutdatum',
    publishDate: 'Publiceringsdatum (valfritt)',
    publishHint: 'Lämna tomt för att publicera direkt.',
    visibility: 'Offentligt eller privat?',
    public: 'Offentligt',
    private: 'Privat',
    privateHint: 'Privat syns bara för dem du delar det med.',
    showCreator: 'Visa ditt användarnamn som den som lade till det?',
    isOwnerPlace: 'Är du ägare till platsen?',
    isOwnerEvent: 'Är du arrangör av evenemanget?',
    yes: 'Ja',
    no: 'Nej',
    submitPlace: 'Skicka in plats',
    submitEvent: 'Skicka in evenemang',
    submitting: 'Skickar…',
    disclaimer: 'Det du lägger till syns direkt när du skickar in det och modereras i efterhand. Vem som helst kan rapportera något vilseledande, olagligt eller felplacerat, och det kan döljas eller tas bort. Upprepade ogiltiga bidrag leder till att kontot spärras från att lägga till.',
    errName: 'Ge det ett namn — det är vad folk ser och söker på.',
    errCategory: 'Välj vilken sort det är.',
    errOtherDetail: 'Skriv vad det är, eftersom det är ”Övrigt”.',
    errLocation: 'Fyll i adressen eller koordinaterna.',
    errPhoto: 'Lägg till minst ett foto.',
    errPhotoType: 'Foton måste vara JPEG, PNG eller WebP.',
    errPhotoSize: 'Ett av fotona är större än 8 MB.',
    errTooManyPhotos: 'Högst sex foton.',
    errDatesRequired: 'Ett evenemang behöver ett start- och ett slutdatum.',
    errEndBeforeStart: 'Slutdatumet måste vara efter startdatumet.',
    errTooLong: 'Evenemang kan pågå i högst 120 dagar — välj ett tidigare slutdatum.',
    errPublishAfterEnd: 'Publiceringsdatumet kan inte vara efter slutdatumet.',
    errChoose: 'Svara på frågorna markerade med stjärna.',
    errEmail: 'Det ser inte ut som en e-postadress. Lämna tomt om du inte vill ange någon.',
    errSubmit: 'Något gick fel när det skulle sparas. Försök igen.',
    errRestricted: 'Ditt konto är begränsat, så du kan inte lägga till platser eller evenemang just nu.',
    errRestrictedUntil: 'Ditt konto är begränsat till och med {date}, så du kan inte lägga till platser eller evenemang förrän då.',
    repickPhotos: 'Välj dina foton igen — webbläsaren sparar dem inte när sidan laddas om.',
    addedAddress: 'Den syns nu. Nålen placerades utifrån adressen — öppna den i appen för att flytta nålen till exakt rätt ställe, när du vill.',
    addedCoords: 'Den syns nu, placerad vid koordinaterna du angav.',
    addedPhotosFailed: 'Den är sparad, men fotona hann inte laddas upp. Lägg till dem i appen.',
    addedClaimFailed: 'Den är sparad, men ditt ägaranspråk gick inte igenom. Gör anspråk i appen.',
    addedPrivate: 'Ditt evenemang är sparat. Det är privat, så det syns inte på kartan — dela det i appen med dem du bjuder in.',
    addedScheduled: 'Sparat. Det syns på kartan från {date}.',
    signInToAdd: 'Logga in för att lägga till en plats eller ett evenemang. Det är gratis och tar en minut.',
  },
};

export function addFormCopy(lang: string): AddFormCopy {
  return ADD_FORM[lang === 'sv' ? 'sv' : 'en'];
}

/*
 * The edit form's own words.
 *
 * Everything it shares with adding — field labels, the lookup errors, the
 * season and price words — comes from ADD_FORM above; only what is peculiar to
 * changing something that already exists lives here.
 */
export interface EditFormCopy {
  titlePlace: string;
  titleEvent: string;
  lead: string;
  leadPartner: string;
  addressLine: string;
  addressHint: string;
  pin: string;
  pinHint: string;
  findFromAddress: string;
  finding: string;
  hoursNa: string;
  morePhotos: string;
  morePhotosHint: string;
  save: string;
  saving: string;
  cancel: string;
  saved: string;
  savedPinMoved: string;
  savedPhotosFailed: string;
  notAllowed: string;
  notAllowedBody: string;
  errSave: string;
  errCategorySave: string;
}

export const EDIT_FORM: Record<'en' | 'sv', EditFormCopy> = {
  en: {
    titlePlace: 'Edit this place',
    titleEvent: 'Edit this event',
    lead: 'Corrections go live straight away. What you change is recorded.',
    leadPartner:
      'You are signed in as a partner, so you can correct any place on the map. Every change is recorded with what it said before.',
    addressLine: 'Address',
    addressHint: 'As you would write it on an envelope. This is what people read on the page.',
    pin: 'Coordinates',
    pinHint: 'Where the pin sits. Change these to move it, or fill them in from the address.',
    findFromAddress: 'Find from the address',
    finding: 'Looking…',
    hoursNa: 'Opening hours don’t apply here',
    morePhotos: 'Add photos',
    morePhotosHint: 'Added to the ones already there. Nothing is replaced.',
    save: 'Save changes',
    saving: 'Saving…',
    cancel: 'Cancel',
    saved: 'Saved.',
    savedPinMoved: 'Saved, and the pin moved.',
    savedPhotosFailed: 'Saved, but the photos didn’t finish uploading. Try them again.',
    notAllowed: 'This isn’t yours to edit',
    notAllowedBody:
      'Places are edited by whoever added them, by a verified owner, and by LocaStar. If something here is wrong, report it and we will look.',
    errSave: 'Something went wrong saving it. Try again.',
    errCategorySave: 'The details were saved, but the category was not. Try that part again.',
  },
  sv: {
    titlePlace: 'Redigera platsen',
    titleEvent: 'Redigera evenemanget',
    lead: 'Rättelser syns direkt. Det du ändrar registreras.',
    leadPartner:
      'Du är inloggad som partner och kan rätta vilken plats som helst på kartan. Varje ändring registreras tillsammans med vad det stod innan.',
    addressLine: 'Adress',
    addressHint: 'Som du skulle skriva den på ett kuvert. Det är den som visas på sidan.',
    pin: 'Koordinater',
    pinHint: 'Där nålen sitter. Ändra dem för att flytta den, eller hämta dem från adressen.',
    findFromAddress: 'Hämta från adressen',
    finding: 'Söker…',
    hoursNa: 'Öppettider gäller inte här',
    morePhotos: 'Lägg till foton',
    morePhotosHint: 'Läggs till de som redan finns. Inget ersätts.',
    save: 'Spara ändringar',
    saving: 'Sparar…',
    cancel: 'Avbryt',
    saved: 'Sparat.',
    savedPinMoved: 'Sparat, och nålen flyttades.',
    savedPhotosFailed: 'Sparat, men fotona hann inte laddas upp. Försök med dem igen.',
    notAllowed: 'Den här är inte din att redigera',
    notAllowedBody:
      'Platser redigeras av den som lade till dem, av en verifierad ägare och av LocaStar. Är något fel här — anmäl det, så tittar vi på det.',
    errSave: 'Något gick fel när det skulle sparas. Försök igen.',
    errCategorySave: 'Uppgifterna sparades, men inte kategorin. Försök med den delen igen.',
  },
};

export function editFormCopy(lang: string): EditFormCopy {
  return EDIT_FORM[lang === 'sv' ? 'sv' : 'en'];
}
