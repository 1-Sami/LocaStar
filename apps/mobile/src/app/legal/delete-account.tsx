import { LegalBullet, LegalPage, LegalSection, LegalText } from '@/components/legal-page';
import { SUPPORT_EMAIL } from '@/constants/support';

/**
 * The publicly reachable account-deletion page Google Play requires.
 *
 * In-app deletion — which LocaStar has had all along at Settings → Delete
 * account — is not sufficient on its own: the Data safety form demands a URL
 * that anyone can open without installing the app, and it is shown on the store
 * listing. Play states what it has to contain, and each line below exists to
 * satisfy one of those requirements: the app name, the steps to request
 * deletion, and which data is erased versus kept.
 *
 * Written from what delete_own_account and the delete-account edge function
 * actually do, not from what would be reassuring to claim. Contributions
 * outlive the account by design — reviews.user_id is nullable precisely so a
 * review can survive its author — and a page that implied otherwise would be
 * contradicted by the app within a week of someone checking.
 */
export default function DeleteAccountInfoScreen() {
  return (
    <LegalPage lastUpdated="10 August 2026">
      <LegalSection title="Deleting your LocaStar account">
        <LegalText>
          You can delete your LocaStar account at any time, from inside the app or by emailing us.
          Deletion is immediate and cannot be undone.
        </LegalText>
      </LegalSection>

      <LegalSection title="How to delete your account">
        <LegalText>In the app:</LegalText>
        <LegalBullet>
          <LegalText>Open LocaStar and sign in.</LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>Go to your profile, then Settings.</LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>Choose Delete account, then confirm with Delete my account.</LegalText>
        </LegalBullet>
        <LegalText>
          If you cannot sign in, or you no longer have the app installed, email {SUPPORT_EMAIL} from the
          address on the account and we will delete it for you.
        </LegalText>
      </LegalSection>

      <LegalSection title="What is deleted">
        <LegalText>These are erased permanently when you delete your account:</LegalText>
        <LegalBullet>
          <LegalText>Your account and email address.</LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>Your username, display name and profile picture.</LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>Any home address you saved as a starting point for searches.</LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>Your favourites, saved places and lists.</LegalText>
        </LegalBullet>
        <LegalBullet>
          <LegalText>Your friends and any pending friend requests.</LegalText>
        </LegalBullet>
      </LegalSection>

      <LegalSection title="What is kept, and why">
        <LegalText>
          Reviews, photos and places you added stay in LocaStar with your name removed from them. They are
          no longer linked to you or to any account, and nothing on them identifies you.
        </LegalText>
        <LegalText>
          This is deliberate. A place someone added and other people have since reviewed, photographed and
          saved does not stop existing because one person leaves — removing it would delete other people&apos;s
          work along with it. Anonymised contributions are kept for as long as LocaStar runs.
        </LegalText>
        <LegalText>
          If you want something you posted removed entirely rather than unlinked, email {SUPPORT_EMAIL} and
          say which review, photo or place, and we will delete it.
        </LegalText>
      </LegalSection>

      <LegalSection title="Deleting some data without deleting your account">
        <LegalText>
          You do not have to delete your account to remove things you have posted. Inside the app you can
          delete individual reviews from My reviews, remove photos you uploaded, and delete places and
          activities you added. Your favourites, saved places and lists can be emptied at any time without
          affecting anything else.
        </LegalText>
        <LegalText>
          For anything you cannot remove yourself, email {SUPPORT_EMAIL} describing what you want deleted.
        </LegalText>
      </LegalSection>

      <LegalSection title="Backups">
        <LegalText>
          Deleted data is removed from LocaStar immediately, but may persist in encrypted database backups
          for a short period before those are rotated out. It is not accessible from the app or used for
          anything once deleted.
        </LegalText>
      </LegalSection>
    </LegalPage>
  );
}
