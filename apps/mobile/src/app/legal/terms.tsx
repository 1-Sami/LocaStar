import { TERMS_OF_SERVICE } from '@locastar/shared';

import { LegalDocumentScreen } from '@/components/legal-page';

/** See the note in privacy.tsx — the text is shared with the website. */
export default function TermsScreen() {
  return <LegalDocumentScreen document={TERMS_OF_SERVICE} />;
}
