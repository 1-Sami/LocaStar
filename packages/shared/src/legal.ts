/*
 * The legal copy, as data, so the app and the website say the same words.
 *
 * It used to live only as JSX inside the app's three legal screens. The website
 * has to serve the same pages — Apple and Google both hold
 * locastar.se/legal/privacy and /legal/terms on file, and Play requires
 * /legal/delete-account to be reachable without signing in — and a second copy
 * of legal text is a second copy that drifts. Whichever one is edited, the
 * other becomes wrong, and nobody notices until it matters.
 *
 * {{support}} is substituted with the support address by whatever renders this,
 * because the app and the website format links differently.
 *
 * Editing this changes both the app and the website. That is the point.
 */

export type LegalBlock =
  | { kind: "text"; text: string }
  | { kind: "bullets"; items: string[] };

export type LegalSectionContent = {
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  slug: "privacy" | "terms" | "delete-account";
  title: string;
  lastUpdated: string;
  sections: LegalSectionContent[];
};

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  lastUpdated: "26 August 2026",
  sections: [
    {
      title: "Who we are",
      blocks: [
        {
          kind: "text",
          text: "LocaStar is operated by Sadek Mirza, Stockholm, Sweden, who is the data controller for the personal data described here. You can reach us at {{support}} for any question about your data.",
        },
      ],
    },
    {
      title: "What we collect",
      blocks: [
        { kind: "text", text: "We only collect what the app needs to work:" },
        {
          kind: "bullets",
          items: [
            "Account details — your email address and password. Passwords are hashed by our authentication provider and are never visible to us.",
            "Profile details — username, display name, and profile picture.",
            "Device location — used while you are searching to find places near you. Your coordinates are sent to our server to run that search and are not stored afterwards.",
            "Content you create — locations and activities you add (including their address, map position and photos), reviews and ratings, photos, lists, saved places, and friend connections.",
            "Safety records — reports you file or that concern your content, and any warnings or restrictions applied to your account, together with the moderator action log.",
            "Technical error reports — if the app fails, it sends us the error, the screen it happened on, your app version and your platform. These contain nothing that identifies you or your account, and they are deleted after 30 days.",
            "Feedback you send us — if you use Send feedback in the app, we receive the message you write, the category you choose, your app version and your platform. You need an account to send it, which is only there to keep out spam: the message is saved without your account, so we cannot tell who sent it and we cannot reply to it. Please do not put personal details in the message.",
          ],
        },
        {
          kind: "text",
          text: "We do not use advertising trackers, and we do not sell or rent your personal data to anyone.",
        },
      ],
    },
    {
      title: "Why we use it, and on what legal basis",
      blocks: [
        {
          kind: "bullets",
          items: [
            "To provide the service you asked for — creating your account, showing places near you, and saving your lists and reviews. Legal basis: performance of a contract.",
            "To keep LocaStar safe — reviewing reports, moderating content, and restricting accounts that break the rules. Legal basis: our legitimate interest in a safe, trustworthy service.",
            "To use your device location. Legal basis: your consent, given through your device’s location permission. You can withdraw it at any time in your device settings; nearby search will then stop working, but the rest of the app will not.",
          ],
        },
      ],
    },
    {
      title: "What other people can see",
      blocks: [
        {
          kind: "text",
          text: "Locations and activities you add, your reviews, your username and profile picture, and any list you mark as public are visible to other people using LocaStar. Private activities and private lists are visible only to you and to anyone you share them with. Your email address, saved places and favourites are never shown to other users.",
        },
      ],
    },
    {
      title: "Where your data is stored",
      blocks: [
        {
          kind: "text",
          text: "Your data is stored on Supabase infrastructure hosted in Ireland (EU), inside the European Economic Area. Supabase acts as our data processor. Where any support or maintenance access takes place from outside the EEA, it is covered by the European Commission’s standard contractual clauses.",
        },
      ],
    },
    {
      title: "How long we keep it",
      blocks: [
        {
          kind: "text",
          text: "We keep your account data for as long as your account exists. If you delete your account, we delete your profile, username, profile picture, saved places, favourites, lists and friend connections.",
        },
        {
          kind: "text",
          text: "What you contributed to the map is kept, but is no longer connected to you. Reviews, photos and places you added stay in the app with your name removed, shown as coming from a deleted account, and can no longer be traced back to you. We do this because other people rely on them: a place can lose its entire rating history if one person leaves, which would make the app less accurate for everyone else. Our legal basis is our legitimate interest in keeping the service accurate and useful.",
        },
        {
          kind: "text",
          text: "If a review or photo of yours contains something personal you want removed rather than unlinked, email us at {{support}} and we will delete it.",
        },
        {
          kind: "text",
          text: "Records of moderation decisions — such as a removed location or a ban — are kept for up to two years so we can enforce our rules consistently and handle appeals, even after an account is gone.",
        },
        {
          kind: "text",
          text: "Feedback sent through Send feedback has no account attached to it, so deleting your account does not affect it and we have no way to find it on request. We keep it for as long as it is useful in deciding what to build.",
        },
      ],
    },
    {
      title: "Your rights",
      blocks: [
        {
          kind: "text",
          text: "Under the GDPR you have the right to access your data, correct it, delete it, receive a copy in a portable format, and object to or restrict how we use it. You can delete your account at any time from Settings, which removes your data as described above. For anything else, email us at {{support}} and we will respond within one month.",
        },
        {
          kind: "text",
          text: "If you believe we have handled your data incorrectly, you can complain to the Swedish Authority for Privacy Protection (Integritetsskyddsmyndigheten, IMY), imy.se.",
        },
      ],
    },
    {
      title: "Children",
      blocks: [
        {
          kind: "text",
          text: "LocaStar is not intended for children under 13. If you believe a child has created an account, contact us and we will remove it.",
        },
      ],
    },
    {
      title: "Changes to this policy",
      blocks: [
        {
          kind: "text",
          text: "If we change how we handle your data, we will update this page and the date at the top. If the change is significant, we will tell you in the app before it takes effect.",
        },
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  lastUpdated: "17 August 2026",
  sections: [
    {
      title: "Who these terms are with",
      blocks: [
        {
          kind: "text",
          text: "LocaStar is operated by Sadek Mirza, Stockholm, Sweden, who can be reached at {{support}}. By creating an account or using the app you agree to these terms. If you do not agree, please do not use LocaStar.",
        },
      ],
    },
    {
      title: "Your account",
      blocks: [
        {
          kind: "text",
          text: "You need an account to add places, write reviews, or save things. You must be at least 13 years old. Keep your password to yourself — you are responsible for what happens under your account. Give us an email address you actually control, because it is how we verify your account and reach you.",
        },
      ],
    },
    {
      title: "What you post",
      blocks: [
        {
          kind: "text",
          text: "You keep ownership of everything you add. By posting it, you give us permission to show it inside LocaStar so the app can work. You can remove your content at any time.",
        },
        { kind: "text", text: "You are responsible for what you post, and you agree not to:" },
        {
          kind: "bullets",
          items: [
            "add places that do not exist, or put them in the wrong location on purpose",
            "post anything hateful, harassing, threatening, discriminatory or sexually explicit",
            "write fake reviews, or reviews for a place you have not actually been to",
            "upload photos you do not have the right to use, or that show identifiable people without their agreement",
            "post someone’s private information, or use LocaStar to advertise, spam or scam",
            "add a private location or activity that is unlawful, or that you do not have the right to organise",
          ],
        },
      ],
    },
    {
      title: "How moderation works",
      blocks: [
        {
          kind: "text",
          text: "What you add appears immediately — we do not review it first. Anyone can report content, and reports are handled by our moderators, who may dismiss the report, remove the content, issue a warning, or restrict the account behind it.",
        },
        {
          kind: "text",
          text: "A restriction can be temporary or permanent. While restricted you can still sign in and browse, but you cannot post reviews, add places, share, or send requests. Every moderator action is recorded. If you think a decision was wrong, email {{support}} and we will look at it again.",
        },
      ],
    },
    {
      title: "Accuracy and your safety",
      blocks: [
        {
          kind: "text",
          text: "Almost everything in LocaStar is added by other people, not by us. We do not check that a place exists, that it is open, that it is safe, or that it is accurately described. Opening hours, addresses and ratings can all be wrong or out of date.",
        },
        {
          kind: "text",
          text: "Use your own judgement, especially outdoors. Going to a place you found in LocaStar is your own decision and at your own risk. Nothing in the app is advice about whether an activity is safe or suitable for you.",
        },
      ],
    },
    {
      title: "Our responsibility",
      blocks: [
        {
          kind: "text",
          text: "We work to keep LocaStar available and working, but we provide it as it is. We are not liable for content other users post, for anything that happens when you visit a place you found here, or for losses caused by the app being unavailable. Nothing in these terms limits liability that cannot be limited under Swedish law, including liability for death or personal injury caused by negligence. Your statutory rights as a consumer are unaffected.",
        },
      ],
    },
    {
      title: "Ending your use",
      blocks: [
        {
          kind: "text",
          text: "You can delete your account at any time from Settings. We may suspend or close an account that repeatedly breaks these terms, or where we are required to by law.",
        },
      ],
    },
    {
      title: "Changes and governing law",
      blocks: [
        {
          kind: "text",
          text: "We may update these terms as LocaStar develops. If a change is significant, we will tell you in the app before it takes effect. These terms are governed by Swedish law, and disputes fall to the Swedish courts. As a consumer you may also use the EU Online Dispute Resolution platform.",
        },
      ],
    },
  ],
};

export const DELETE_ACCOUNT_INFO: LegalDocument = {
  slug: "delete-account",
  title: "Deleting your account",
  lastUpdated: "10 August 2026",
  sections: [
    {
      title: "Deleting your LocaStar account",
      blocks: [
        {
          kind: "text",
          text: "You can delete your LocaStar account at any time, from inside the app or by emailing us. Deletion is immediate and cannot be undone.",
        },
      ],
    },
    {
      title: "How to delete your account",
      blocks: [
        { kind: "text", text: "In the app:" },
        {
          kind: "bullets",
          items: [
            "Open LocaStar and sign in.",
            "Go to your profile, then Settings.",
            "Choose Delete account, then confirm with Delete my account.",
          ],
        },
        {
          kind: "text",
          text: "If you cannot sign in, or you no longer have the app installed, email {{support}} from the address on the account and we will delete it for you.",
        },
      ],
    },
    {
      title: "What is deleted",
      blocks: [
        { kind: "text", text: "These are erased permanently when you delete your account:" },
        {
          kind: "bullets",
          items: [
            "Your account and email address.",
            "Your username, display name and profile picture.",
            "Your favourites, saved places and lists.",
            "Your friends and any pending friend requests.",
          ],
        },
      ],
    },
    {
      title: "What is kept, and why",
      blocks: [
        {
          kind: "text",
          text: "Reviews, photos and places you added stay in LocaStar with your name removed from them. They are no longer linked to you or to any account, and nothing on them identifies you.",
        },
        {
          kind: "text",
          text: "This is deliberate. A place someone added and other people have since reviewed, photographed and saved does not stop existing because one person leaves — removing it would delete other people’s work along with it. Anonymised contributions are kept for as long as LocaStar runs.",
        },
        {
          kind: "text",
          text: "If you want something you posted removed entirely rather than unlinked, email {{support}} and say which review, photo or place, and we will delete it.",
        },
      ],
    },
    {
      title: "Deleting some data without deleting your account",
      blocks: [
        {
          kind: "text",
          text: "You do not have to delete your account to remove things you have posted. Inside the app you can delete individual reviews from My reviews, remove photos you uploaded, and delete places and activities you added. Your favourites, saved places and lists can be emptied at any time without affecting anything else.",
        },
        {
          kind: "text",
          text: "For anything you cannot remove yourself, email {{support}} describing what you want deleted.",
        },
      ],
    },
    {
      title: "Backups",
      blocks: [
        {
          kind: "text",
          text: "Deleted data is removed from LocaStar immediately, but may persist in encrypted database backups for a short period before those are rotated out. It is not accessible from the app or used for anything once deleted.",
        },
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = [PRIVACY_POLICY, TERMS_OF_SERVICE, DELETE_ACCOUNT_INFO];
