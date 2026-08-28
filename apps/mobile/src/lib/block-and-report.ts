import { reportList, reportLocation, reportReview } from '@locastar/shared';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/lib/auth-context';
import { useBlockedUsers } from '@/lib/blocked-users-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

/**
 * The piece of content the block was triggered from.
 *
 * There is always one, because blocking is only offered from something a
 * person actually wrote. That is what lets the block file a report: App Store
 * guideline 1.2 asks that blocking "notify the developer of the inappropriate
 * content", and without knowing which content it would only ever be able to
 * say that somebody objected to somebody.
 */
export type BlockSource =
  | { kind: 'review'; reviewId: string }
  | { kind: 'reviewPhoto'; reviewId: string; reviewPhotoId: string }
  | { kind: 'location'; locationId: string }
  | { kind: 'list'; listId: string };

/*
 * Stored in English, like every other report reason — see the note at the top
 * of report-modal. A moderator's queue in two languages cannot be grouped.
 */
const BLOCK_REPORT_REASON = 'Inappropriate content';
const BLOCK_REPORT_DETAILS = 'Filed automatically when this user was blocked.';

/**
 * Blocks the author of a piece of content, hides them immediately, and tells
 * the moderators why.
 *
 * All three happen on one confirmation on purpose. Asking someone being
 * harassed to block *and then* file a separate report is asking them to do the
 * moderation team's paperwork; and a block that told us nothing would leave
 * the account free to do the same to the next person.
 *
 * The report is best-effort. If it fails the block still stands, because the
 * half that protects the person must not depend on the half that informs us.
 */
export function useBlockAndReport() {
  const { session } = useAuth();
  const { block } = useBlockedUsers();
  const { t } = useTranslation();

  const blockAndReport = async (
    targetUserId: string,
    displayName: string | null,
    source: BlockSource
  ): Promise<boolean> => {
    if (!session || targetUserId === session.user.id) return false;

    const name = displayName ?? t('common.somePerson');
    const confirmed = await confirmAsync(
      t('safety.blockTitle', { name }),
      t('safety.blockBody', { name }),
      t('safety.blockConfirm')
    );
    if (!confirmed) return false;

    await block(targetUserId);

    try {
      const reporterId = session.user.id;
      if (source.kind === 'review') {
        await reportReview(supabase, {
          reviewId: source.reviewId,
          reporterId,
          reason: BLOCK_REPORT_REASON,
          details: BLOCK_REPORT_DETAILS,
        });
      } else if (source.kind === 'reviewPhoto') {
        await reportReview(supabase, {
          reviewId: source.reviewId,
          reporterId,
          reason: BLOCK_REPORT_REASON,
          details: BLOCK_REPORT_DETAILS,
          reviewPhotoId: source.reviewPhotoId,
        });
      } else if (source.kind === 'location') {
        await reportLocation(supabase, {
          locationId: source.locationId,
          reporterId,
          reason: BLOCK_REPORT_REASON,
          details: BLOCK_REPORT_DETAILS,
        });
      } else {
        await reportList(supabase, {
          listId: source.listId,
          reporterId,
          reason: BLOCK_REPORT_REASON,
          details: BLOCK_REPORT_DETAILS,
        });
      }
    } catch (err) {
      // Swallowed deliberately — see the note above. The person is already
      // protected; only our visibility of it failed.
      console.error('Blocked, but could not file the accompanying report', err);
    }

    return true;
  };

  return blockAndReport;
}
