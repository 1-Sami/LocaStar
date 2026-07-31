import { LegalBullet, LegalPage, LegalSection, LegalText } from '@/components/legal-page';
import { SUPPORT_EMAIL } from '@/constants/support';

/**
 * Written to match how the app actually behaves — content publishes
 * immediately and is moderated afterwards, bans follow the two-step flow in
 * the moderation system. Needs review by a lawyer before launch.
 */
export default function TermsScreen() {
  return (
    <LegalPage lastUpdated="29 July 2026">
      <LegalSection title="Who these terms are with">
        <LegalText>
          LocaStar is operated by Application AB, Hundhamravägen 7, 145 70 Norsborg, Stockholm, Sweden.
          By creating an account or using the app you agree to these terms. If you do not agree, please
          do not use LocaStar.
        </LegalText>
      </LegalSection>

      <LegalSection title="Your account">
        <LegalText>
          You need an account to add places, write reviews, or save things. You must be at least 13 years
          old. Keep your password to yourself — you are responsible for what happens under your account.
          Give us an email address you actually control, because it is how we verify your account and
          reach you.
        </LegalText>
      </LegalSection>

      <LegalSection title="What you post">
        <LegalText>
          You keep ownership of everything you add. By posting it, you give us permission to show it
          inside LocaStar so the app can work. You can remove your content at any time.
        </LegalText>
        <LegalText>You are responsible for what you post, and you agree not to:</LegalText>
        <LegalBullet>
          <LegalText>add places that do not exist, or put them in the wrong location on purpose</LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            post anything hateful, harassing, threatening, discriminatory or sexually explicit
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            write fake reviews, or reviews for a place you have not actually been to
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            upload photos you do not have the right to use, or that show identifiable people without
            their agreement
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            post someone&apos;s private information, or use LocaStar to advertise, spam or scam
          </LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>
            add a private location or activity that is unlawful, or that you do not have the right to
            organise
          </LegalText>
        </LegalBullet>
      </LegalSection>

      <LegalSection title="How moderation works">
        <LegalText>
          What you add appears immediately — we do not review it first. Anyone can report content, and
          reports are handled by our moderators, who may dismiss the report, remove the content, issue a
          warning, or restrict the account behind it.
        </LegalText>
        <LegalText>
          A restriction can be temporary or permanent. While restricted you can still sign in and browse,
          but you cannot post reviews, add places, share, or send requests. Every moderator action is
          recorded. If you think a decision was wrong, email {SUPPORT_EMAIL} and we will look at
          it again.
        </LegalText>
      </LegalSection>

      <LegalSection title="Accuracy and your safety">
        <LegalText>
          Almost everything in LocaStar is added by other people, not by us. We do not check that a place
          exists, that it is open, that it is safe, or that it is accurately described. Opening hours,
          addresses and ratings can all be wrong or out of date.
        </LegalText>
        <LegalText>
          Use your own judgement, especially outdoors. Going to a place you found in LocaStar is your own
          decision and at your own risk. Nothing in the app is advice about whether an activity is safe or
          suitable for you.
        </LegalText>
      </LegalSection>

      <LegalSection title="Our responsibility">
        <LegalText>
          We work to keep LocaStar available and working, but we provide it as it is. We are not liable
          for content other users post, for anything that happens when you visit a place you found here,
          or for losses caused by the app being unavailable. Nothing in these terms limits liability that
          cannot be limited under Swedish law, including liability for death or personal injury caused by
          negligence. Your statutory rights as a consumer are unaffected.
        </LegalText>
      </LegalSection>

      <LegalSection title="Ending your use">
        <LegalText>
          You can delete your account at any time from Settings. We may suspend or close an account that
          repeatedly breaks these terms, or where we are required to by law.
        </LegalText>
      </LegalSection>

      <LegalSection title="Changes and governing law">
        <LegalText>
          We may update these terms as LocaStar develops. If a change is significant, we will tell you in
          the app before it takes effect. These terms are governed by Swedish law, and disputes fall to
          the Swedish courts. As a consumer you may also use the EU Online Dispute Resolution platform.
        </LegalText>
      </LegalSection>
    </LegalPage>
  );
}
