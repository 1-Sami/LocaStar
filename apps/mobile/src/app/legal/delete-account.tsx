import { DELETE_ACCOUNT_INFO } from '@locastar/shared';

import { LegalDocumentScreen } from '@/components/legal-page';

/**
 * Reachable without signing in, and required by Google Play — it has 404'd
 * once and blocked a review. The website serves the same document.
 */
export default function DeleteAccountInfoScreen() {
  return <LegalDocumentScreen document={DELETE_ACCOUNT_INFO} />;
}
