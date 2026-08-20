/*
 * The About story, in both languages.
 *
 * It lives here because two frontends tell it: the app's About screen and the
 * website's /about page. It was duplicated between them once — the website
 * carried a hand-copied English version while the app kept the real one, and a
 * copy is a thing that drifts. Same reasoning as legal.ts and categoryNames.ts.
 *
 * The Swedish is the app's own Swedish rather than a second translation of the
 * same story, so the two can never tell it differently.
 */

export interface AboutCopy {
  ballTitle: string;
  ball1: string;
  ball2: string;
  ball3: string;
  gapTitle: string;
  gap1: string;
  gap2: string;
  gap3: string;
  gap4: string;
  doTitle: string;
  findLead: string;
  findBody: string;
  saveLead: string;
  saveBody: string;
  privateLead: string;
  privateBody: string;
  contributeLead: string;
  contributeBody: string;
  growTitle: string;
  grow1: string;
  grow2: string;
  supportTitle: string;
  supportPrefix: string;
  supportSuffix: string;
  attributionPrefix: string;
  attributionLink: string;
  attributionSuffix: string;
  originalInstall: string;
}

export const ABOUT: Record<'en' | 'sv', AboutCopy> = {
  en: {
    ballTitle: "It started with a basketball",
    ball1: "Every time I found myself in a new part of town with a ball under my arm, I hit the same question: where do I actually go and play?",
    ball2: "The answer was usually out there somewhere. I’d scan the map for nearby schools and parks, guess which ones might have a court, then hope it was open, decent, and worth the trip. Sometimes that worked. Often I’d walk twenty minutes to find a bent rim and no net.",
    ball3: "That’s the whole reason LocaStar exists.",
    gapTitle: "The places between the listings",
    gap1: "Map apps are built around businesses, and they’re very good at it. Activities are just harder to pin down — a basketball court isn’t a listing of its own, it’s tucked inside a school or a park. Finding one means guessing which places might have it, then checking them one by one.",
    gap2: "So that knowledge stays scattered. A little on a forum, a little in a group chat, and most of it in the heads of people who already live there. If you’re new to an area — or just new to that side of town — it may as well not exist.",
    gap3: "So we built LocaStar around that gap: one map of things to actually go and do, described by the people who have been there.",
    gap4: "LocaStar starts from the activity instead. You look for a court, a slope, a trail or a festival, and you get the spot itself: what it’s like, who’s been there, and how to get to it.",
    doTitle: "What you can do here",
    findLead: "Find places worth going to.",
    findBody: "Search by activity or browse what’s near you, with ratings, photos and directions from people who actually showed up.",
    saveLead: "Save and organise.",
    saveBody: "Keep favourites, build a “want to go” list, and group places into lists you can keep private or share with everyone.",
    privateLead: "Plan something private.",
    privateBody: "Organising a party, a wedding, or a film shoot? Create it as a private activity and share it only with the people you invite.",
    contributeLead: "Leave something behind.",
    contributeBody: "Add a rating, a photo, or a spot nobody has listed yet.",
    growTitle: "The map grows with you",
    grow1: "LocaStar is young, and we’d rather say so than pretend otherwise: some areas are already full, others are nearly empty. It gets better every time someone adds a place they know.",
    grow2: "So if you know the good court, the quiet trail, or the slope that’s worth the drive — add it. The next person turning up with a ball under their arm will be glad you did.",
    supportTitle: "Need a hand?",
    supportPrefix: "Questions, problems, or something that looks wrong on the map — write to us at ",
    supportSuffix: " and a person will answer.",
    attributionPrefix: "Some locations include data from ",
    attributionLink: "© OpenStreetMap contributors",
    attributionSuffix: ", used under the Open Database License.",
    originalInstall: "Original install — no updates applied yet",
  },
  sv: {
    ballTitle: "Det började med en basketboll",
    ball1: "Varje gång jag hamnade i en ny del av stan med en boll under armen slog samma fråga till: var ska jag faktiskt spela?",
    ball2: "Svaret fanns oftast där ute någonstans. Jag skannade kartan efter skolor och parker i närheten, gissade vilka som kunde ha en plan, och hoppades att den var öppen, hyfsad och värd turen. Ibland funkade det. Ofta gick jag i tjugo minuter för att hitta en böjd korg utan nät.",
    ball3: "Det är hela anledningen till att LocaStar finns.",
    gapTitle: "Platserna mellan träffarna",
    gap1: "Kartappar är byggda kring företag, och det gör de riktigt bra. Aktiviteter är helt enkelt svårare att sätta fingret på — en basketplan är ingen egen träff, den ligger inbakad i en skola eller en park. Att hitta en innebär att gissa vilka ställen som kan ha en, och sedan kolla dem ett i taget.",
    gap2: "Så kunskapen förblir utspridd. Lite på ett forum, lite i en gruppchatt, och mest av allt i huvudet på dem som redan bor där. Är du ny i ett område — eller bara ny i den delen av stan — kan den lika gärna inte finnas.",
    gap3: "Så vi byggde LocaStar kring det glappet: en karta över saker att faktiskt göra, beskrivna av dem som har varit där.",
    gap4: "LocaStar utgår från aktiviteten i stället. Du letar efter en plan, en backe, ett spår eller en festival, och får själva stället: hur det är, vilka som varit där och hur du tar dig dit.",
    doTitle: "Det här kan du göra här",
    findLead: "Hitta ställen värda att åka till.",
    findBody: "Sök på aktivitet eller bläddra bland det som finns nära dig, med betyg, foton och vägbeskrivningar från folk som faktiskt har varit där.",
    saveLead: "Spara och organisera.",
    saveBody: "Spara favoriter, bygg en ”vill besöka”-lista och samla platser i listor som du kan hålla privata eller dela med alla.",
    privateLead: "Planera något privat.",
    privateBody: "Ordnar du en fest, ett bröllop eller en inspelning? Skapa det som en privat aktivitet och dela den bara med dem du bjuder in.",
    contributeLead: "Lämna något efter dig.",
    contributeBody: "Lägg till ett betyg, ett foto eller ett ställe som ingen har lagt in än.",
    growTitle: "Kartan växer med dig",
    grow1: "LocaStar är ungt, och vi säger hellre det än låtsas något annat: vissa områden är redan fulla, andra nästan tomma. Det blir bättre varje gång någon lägger till ett ställe de känner till.",
    grow2: "Så om du känner till den bra planen, det lugna spåret eller backen som är värd bilturen — lägg in den. Nästa person som dyker upp med en boll under armen kommer att bli glad att du gjorde det.",
    supportTitle: "Behöver du hjälp?",
    supportPrefix: "Frågor, problem eller något som ser fel ut på kartan — skriv till oss på ",
    supportSuffix: " så svarar en människa.",
    attributionPrefix: "Vissa platser innehåller data från ",
    attributionLink: "© OpenStreetMap contributors",
    attributionSuffix: ", som används under Open Database License.",
    originalInstall: "Originalinstallation — inga uppdateringar tillagda än",
  },
};

/** The About copy for one language, falling back to English. */
export function aboutCopy(language: 'en' | 'sv'): AboutCopy {
  return ABOUT[language] ?? ABOUT.en;
}
