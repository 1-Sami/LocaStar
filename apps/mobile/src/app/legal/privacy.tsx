import { PRIVACY_POLICY } from '@locastar/shared';

import { LegalDocumentScreen } from '@/components/legal-page';

/**
 * The words live in packages/shared/src/legal.ts, which the website renders
 * too. Apple and Google hold locastar.se/legal/privacy on file, so the copy
 * there and the copy here have to be the same copy — not two that agree today.
 */
export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} />;
}
