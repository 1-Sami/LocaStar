import { LegalBullet, LegalPage, LegalSection, LegalText } from '@/components/legal-page';
import { SUPPORT_EMAIL } from '@/constants/support';

/**
 * Drafted from what the app actually collects (see the Supabase schema), not
 * from a generic template. Still needs review by a lawyer before launch.
 */
export default function PrivacyPolicyScreen() {
  return (
    <LegalPage lastUpdated="1 August 2026">
      <LegalSection title="Who we are">
        <LegalText>
          LocaStar is operated by Application AB, Hundhamravägen 7, 145 70 Norsborg, Stockholm, Sweden.
          Application AB is the data controller for the personal data described here. You can reach us at
          {' '}{SUPPORT_EMAIL} for any question about your data.
        </LegalText>
      </LegalSection>

      <LegalSection title="What we collect">
        <LegalText>We only collect what the app needs to work:</LegalText>
        <LegalBullet>
          <LegalText>
            Account details — your email address and password. Passwords are hashed by our authentication
            provider and are never visible to us.
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            Profile details — username, display name, profile picture, and optionally a home address you
            choose to save as a starting point for nearby searches.
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            Device location — used while you are searching to find places near you. Your coordinates are
            sent to our server to run that search and are not stored afterwards.
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            Content you create — locations and activities you add (including their address, map position
            and photos), reviews and ratings, photos, lists, saved places, and friend connections.
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            Safety records — reports you file or that concern your content, and any warnings or
            restrictions applied to your account, together with the moderator action log.
          </LegalText>
        </LegalBullet>
        <LegalText>
          We do not use advertising trackers, and we do not sell or rent your personal data to anyone.
        </LegalText>
      </LegalSection>

      <LegalSection title="Why we use it, and on what legal basis">
        <LegalBullet>
          <LegalText>
            To provide the service you asked for — creating your account, showing places near you, and
            saving your lists and reviews. Legal basis: performance of a contract.
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            To keep LocaStar safe — reviewing reports, moderating content, and restricting accounts that
            break the rules. Legal basis: our legitimate interest in a safe, trustworthy service.
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            To use your device location. Legal basis: your consent, given through your device&apos;s
            location permission. You can withdraw it at any time in your device settings; nearby search
            will then stop working, but the rest of the app will not.
          </LegalText>
        </LegalBullet>
      </LegalSection>

      <LegalSection title="What other people can see">
        <LegalText>
          Locations and activities you add, your reviews, your username and profile picture, and any list
          you mark as public are visible to other people using LocaStar. Private activities and private
          lists are visible only to you and to anyone you share them with. Your email address, home
          address, saved places and favourites are never shown to other users.
        </LegalText>
      </LegalSection>

      <LegalSection title="Where your data is stored">
        <LegalText>
          Your data is stored on Supabase infrastructure hosted in Ireland (EU), inside the European
          Economic Area. Supabase acts as our data processor. Where any support or maintenance access
          takes place from outside the EEA, it is covered by the European Commission&apos;s standard
          contractual clauses.
        </LegalText>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <LegalText>
          We keep your account data for as long as your account exists. If you delete your account, we
          delete your profile, username, profile picture, home address, saved places, favourites, lists
          and friend connections.
        </LegalText>
        <LegalText>
          What you contributed to the map is kept, but is no longer connected to you. Reviews, photos and
          places you added stay in the app with your name removed, shown as coming from a deleted
          account, and can no longer be traced back to you. We do this because other people rely on them:
          a place can lose its entire rating history if one person leaves, which would make the app less
          accurate for everyone else. Our legal basis is our legitimate interest in keeping the service
          accurate and useful.
        </LegalText>
        <LegalText>
          If a review or photo of yours contains something personal you want removed rather than
          unlinked, email us at {SUPPORT_EMAIL} and we will delete it.
        </LegalText>
        <LegalText>
          Records of moderation decisions — such as a removed location or a ban — are kept for up to two
          years so we can enforce our rules consistently and handle appeals, even after an account is
          gone.
        </LegalText>
      </LegalSection>

      <LegalSection title="Your rights">
        <LegalText>
          Under the GDPR you have the right to access your data, correct it, delete it, receive a copy in
          a portable format, and object to or restrict how we use it. You can delete your account at any
          time from Settings, which removes your data as described above. For anything else, email us at
          {' '}{SUPPORT_EMAIL} and we will respond within one month.
        </LegalText>
        <LegalText>
          If you believe we have handled your data incorrectly, you can complain to the Swedish Authority
          for Privacy Protection (Integritetsskyddsmyndigheten, IMY), imy.se.
        </LegalText>
      </LegalSection>

      <LegalSection title="Children">
        <LegalText>
          LocaStar is not intended for children under 13. If you believe a child has created an account,
          contact us and we will remove it.
        </LegalText>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <LegalText>
          If we change how we handle your data, we will update this page and the date at the top. If the
          change is significant, we will tell you in the app before it takes effect.
        </LegalText>
      </LegalSection>
    </LegalPage>
  );
}
