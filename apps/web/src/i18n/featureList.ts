/*
 * What each promise on /features actually means, line by line.
 *
 * Here rather than in ui.ts because it is 24 items of two sentences each in two
 * languages: as flat keys it would be 100 entries interleaved with the rest of
 * the site's labels, and the shape — which band an item belongs to, and whether
 * it is app-only — would live in the page instead of beside the words. Same
 * reasoning as about.ts, which keeps the About story as data rather than keys.
 *
 * The four band headings themselves are NOT here. They come from aboutCopy in
 * @locastar/shared, which the app's About screen tells too, and a second copy
 * is a copy that drifts.
 *
 * `where` is the honest part: most of the map is readable on the website, but
 * adding, reviewing, photographing, sharing with a friend and blocking are all
 * things the app does. Saying so on the page is better than a visitor finding
 * out by looking for a button that is not there.
 */

export type FeatureWhere = 'app' | 'both';

export interface FeatureItem {
  title: string;
  body: string;
  where: FeatureWhere;
}

export interface FeatureBlock {
  heading: string;
  lead: string;
  items: FeatureItem[];
}

export interface FeatureDetail {
  /** The marker beside each line. */
  whereApp: string;
  whereBoth: string;
  /** Items under each of the four illustrated bands, in their order. */
  find: FeatureItem[];
  save: FeatureItem[];
  private: FeatureItem[];
  contribute: FeatureItem[];
  /** The two sections that have no illustration of their own. */
  account: FeatureBlock;
  safety: FeatureBlock;
}

export const FEATURE_DETAIL: Record<'en' | 'sv', FeatureDetail> = {
  en: {
    whereApp: 'App',
    whereBoth: 'App · Web',
    find: [
      {
        title: 'Search for anything',
        body: 'A name, a street, a town, or the activity itself. Type “basketball” and you get the courts, not only places with the word in their name.',
        where: 'both',
      },
      {
        title: 'Narrow it down',
        body: 'Places or events. Summer or winter. Free or paid. Any of 50+ activity types, several at once.',
        where: 'both',
      },
      {
        title: 'Everything about a place',
        body: 'Photos, rating and reviews, address, distance, free or paid, opening hours, website and phone where they are known — then one tap for directions in your own maps app.',
        where: 'both',
      },
    ],
    save: [
      {
        title: 'Favourites, and want-to-go',
        body: 'The heart is for places you love and return to. The bookmark is for the ones you are still planning.',
        where: 'both',
      },
      {
        title: 'Lists',
        body: '“Summer with the kids”, “Courts in Uppsala”. Name it, describe it, keep it private or make it public, and add to it straight from any place.',
        where: 'both',
      },
      {
        title: 'Other people’s lists',
        body: 'Browse the public ones in Community, newest or most liked. Like the good ones and they stay in your Saved.',
        where: 'both',
      },
      {
        title: 'Event reminders',
        body: 'Save an event and you hear the day before it starts, and again on its last day.',
        where: 'app',
      },
    ],
    private: [
      {
        title: 'Private means private',
        body: 'It never appears on the map, in search, or on the website. Only the people you share it with can open it.',
        where: 'app',
      },
      {
        title: 'Dates, and a publish date',
        body: 'Set when it starts and ends — up to 120 days — and optionally a date for it to appear, if you want to line something up in advance.',
        where: 'app',
      },
      {
        title: 'It clears up after itself',
        body: 'When an event ends it leaves the map on its own, along with the reviews and photos left on it. Only you still see your own.',
        where: 'app',
      },
    ],
    contribute: [
      {
        title: 'Add a place',
        body: 'A court, a beach, a trail, an outdoor gym. One photo you took, a name, the activity, and a pin you drag to the exact spot — then season, free or paid, hours, website and phone if you know them.',
        where: 'app',
      },
      {
        title: 'Add an event',
        body: 'A festival, a match, a meet-up. The same, plus the dates it runs.',
        where: 'app',
      },
      {
        title: 'It warns you about duplicates',
        body: 'Anything already mapped a few metres from your pin is shown while you place it, so the same skatepark does not land on the map three times.',
        where: 'app',
      },
      {
        title: 'Review what you have been to',
        body: 'One to five stars, with a title, a few words and your own photos if you like. Edit or delete yours whenever you want.',
        where: 'app',
      },
      {
        title: 'Your name, or not',
        body: 'Choose whether “Added by” carries your username, and change your mind later. You can also fix, move or delete anything you added.',
        where: 'app',
      },
      {
        title: 'Claim your business',
        body: 'If a place on the map is yours, send your verification details and keep its hours, contact details and photos right.',
        where: 'app',
      },
    ],
    account: {
      heading: 'Friends, sharing, and your own account',
      lead: 'Somewhere worth going is worth telling someone about — and everything you keep is yours to take back.',
      items: [
        {
          title: 'Add friends',
          body: 'Search by username or email, send a request, accept or decline what comes in.',
          where: 'both',
        },
        {
          title: 'Share a place or a list',
          body: 'Send it to a friend and it lands in their Favourites or Lists. Stop sharing whenever you like.',
          where: 'app',
        },
        {
          title: 'Or share with anybody',
          body: 'Every place has a web address that works without the app and without an account.',
          where: 'both',
        },
        {
          title: 'Your activity at a glance',
          body: 'Favourites, bookmarks, shares, reviews, places added, lists and events — counted on your profile, listed underneath.',
          where: 'both',
        },
        {
          title: 'Leave whenever you want',
          body: 'Deleting your account removes your profile, username, picture, favourites, lists and friends for good. What you gave the map stays, without your name on it.',
          where: 'both',
        },
      ],
    },
    safety: {
      heading: 'If something is wrong',
      lead: 'Anyone can add to the map, so anyone can flag what does not belong.',
      items: [
        {
          title: 'Report a place, a review or a photo',
          body: 'Pick a reason — spam, inappropriate, doesn’t exist, wrong information, duplicate — and add anything else we should know. A moderator reads every one.',
          where: 'both',
        },
        {
          title: 'Reported photos vanish at once',
          body: 'A reported photo is hidden the moment it is flagged, and stays hidden until a person has looked at it.',
          where: 'both',
        },
        {
          title: 'Block someone',
          body: 'Their reviews, photos and lists stop reaching you, and they cannot send you requests or share anything with you.',
          where: 'app',
        },
        {
          title: 'Tell us directly',
          body: 'Send feedback from inside the app and it goes straight to the people building it.',
          where: 'app',
        },
      ],
    },
  },

  sv: {
    whereApp: 'Appen',
    whereBoth: 'Appen · Webben',
    find: [
      {
        title: 'Sök efter vad som helst',
        body: 'Ett namn, en gata, en ort eller aktiviteten i sig. Skriv ”basket” och du får planerna, inte bara platser med ordet i namnet.',
        where: 'both',
      },
      {
        title: 'Smalna av',
        body: 'Platser eller evenemang. Sommar eller vinter. Gratis eller avgift. Vilken som helst av 50+ aktivitetstyper, flera på en gång.',
        where: 'both',
      },
      {
        title: 'Allt om en plats',
        body: 'Foton, betyg och omdömen, adress, avstånd, gratis eller avgift, öppettider, webbplats och telefon när de är kända — och ett tryck för vägbeskrivning i din egen kartapp.',
        where: 'both',
      },
    ],
    save: [
      {
        title: 'Favoriter och bokmärken',
        body: 'Hjärtat är för platser du älskar och återvänder till. Bokmärket är för dem du fortfarande planerar.',
        where: 'both',
      },
      {
        title: 'Listor',
        body: '”Sommar med barnen”, ”Planer i Uppsala”. Namnge den, beskriv den, håll den privat eller gör den offentlig — och lägg till direkt från en plats.',
        where: 'both',
      },
      {
        title: 'Andras listor',
        body: 'Bläddra bland de offentliga under Gemenskap, senaste eller mest gillade. Gilla dem du gillar, så ligger de kvar under Sparat.',
        where: 'both',
      },
      {
        title: 'Påminnelser om evenemang',
        body: 'Spara ett evenemang så hör du av oss dagen innan det börjar, och igen på sista dagen.',
        where: 'app',
      },
    ],
    private: [
      {
        title: 'Privat är privat',
        body: 'Det syns aldrig på kartan, i sökningen eller på webbplatsen. Bara de du delar med kan öppna det.',
        where: 'app',
      },
      {
        title: 'Datum, och ett publiceringsdatum',
        body: 'Ange när det börjar och slutar — upp till 120 dagar — och om du vill ett datum då det ska dyka upp.',
        where: 'app',
      },
      {
        title: 'Det städar efter sig',
        body: 'När ett evenemang är slut lämnar det kartan av sig självt, tillsammans med omdömena och fotona som lagts på det. Bara du ser dina egna.',
        where: 'app',
      },
    ],
    contribute: [
      {
        title: 'Lägg till en plats',
        body: 'En plan, en strand, ett spår, ett utegym. Ett foto du tagit själv, ett namn, aktiviteten och en nål du drar till exakt rätt ställe — sedan säsong, gratis eller avgift, öppettider, webbplats och telefon om du vet.',
        where: 'app',
      },
      {
        title: 'Lägg till ett evenemang',
        body: 'En festival, en match, en träff. Samma sak, plus datumen det pågår.',
        where: 'app',
      },
      {
        title: 'Den varnar för dubbletter',
        body: 'Allt som redan finns några meter från din nål visas medan du placerar den, så att samma skatepark inte hamnar på kartan tre gånger.',
        where: 'app',
      },
      {
        title: 'Sätt omdöme på det du varit på',
        body: 'Ett till fem stjärnor, med rubrik, några ord och egna foton om du vill. Ändra eller ta bort ditt när du vill.',
        where: 'app',
      },
      {
        title: 'Ditt namn, eller inte',
        body: 'Välj om ”Tillagd av” ska visa ditt användarnamn, och ändra dig senare. Du kan också rätta, flytta eller ta bort det du lagt till.',
        where: 'app',
      },
      {
        title: 'Gör anspråk på din verksamhet',
        body: 'Om en plats på kartan är din: skicka dina uppgifter och håll öppettider, kontaktuppgifter och foton rätt.',
        where: 'app',
      },
    ],
    account: {
      heading: 'Vänner, delning och ditt eget konto',
      lead: 'Ett ställe värt att gå till är värt att berätta om — och allt du sparar är ditt att ta tillbaka.',
      items: [
        {
          title: 'Lägg till vänner',
          body: 'Sök på användarnamn eller e-post, skicka en förfrågan, acceptera eller avböj det som kommer in.',
          where: 'both',
        },
        {
          title: 'Dela en plats eller en lista',
          body: 'Skicka den till en vän så landar den i deras Favoriter eller Listor. Sluta dela när du vill.',
          where: 'app',
        },
        {
          title: 'Eller dela med vem som helst',
          body: 'Varje plats har en webbadress som fungerar utan app och utan konto.',
          where: 'both',
        },
        {
          title: 'Din aktivitet på ett ögonkast',
          body: 'Favoriter, bokmärken, delat, omdömen, tillagda platser, listor och evenemang — räknade på din profil, listade under.',
          where: 'both',
        },
        {
          title: 'Lämna när du vill',
          body: 'Att ta bort kontot raderar din profil, ditt användarnamn, din bild, favoriter, listor och vänner för gott. Det du gett kartan blir kvar, utan ditt namn på.',
          where: 'both',
        },
      ],
    },
    safety: {
      heading: 'Om något är fel',
      lead: 'Vem som helst kan lägga till på kartan, så vem som helst kan flagga det som inte hör hemma.',
      items: [
        {
          title: 'Rapportera en plats, ett omdöme eller ett foto',
          body: 'Välj en anledning — spam, olämpligt, finns inte, felaktig information, dubblett — och lägg till annat vi bör veta. En moderator läser varenda en.',
          where: 'both',
        },
        {
          title: 'Rapporterade foton försvinner direkt',
          body: 'Ett rapporterat foto döljs i samma stund det flaggas, och förblir dolt tills en människa har tittat på det.',
          where: 'both',
        },
        {
          title: 'Blockera någon',
          body: 'Deras omdömen, foton och listor når dig inte längre, och de kan inte skicka förfrågningar eller dela något med dig.',
          where: 'app',
        },
        {
          title: 'Säg det direkt till oss',
          body: 'Skicka feedback inifrån appen så går den rakt till dem som bygger den.',
          where: 'app',
        },
      ],
    },
  },
};
