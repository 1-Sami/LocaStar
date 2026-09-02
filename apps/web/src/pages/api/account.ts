import {
  acceptFriendRequest,
  deleteNotification,
  markAllNotificationsRead,
  removeFriendship,
  updateProfile,
  type NotificationPreferences,
} from '@locastar/shared';
import type { APIRoute } from 'astro';

import { localePath } from '../../i18n/ui';
import { currentUser } from '../../lib/auth';
import { safePath } from '../../lib/redirects';

export const prerender = false;

/*
 * The account page's own writes: friends, notifications and settings.
 *
 * One endpoint rather than three, because they share every line of this except
 * the middle — the session, the redirect back, and the rule that a signed-out
 * request is bounced to sign-in rather than silently doing nothing.
 *
 * POST and a redirect, like the other routes here, so every control on the
 * account page is a plain form and none of it needs JavaScript.
 *
 * Every write goes through the visitor's own session, so RLS decides who may
 * do what. Nothing here re-implements that check.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user, supabase } = await currentUser(cookies, request.headers);

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const back = safePath(String(form.get('back') ?? '/account'));
  const lang = back === '/sv' || back.startsWith('/sv/') ? 'sv' : 'en';

  if (!user) {
    return redirect(`${localePath('/auth/sign-in', lang)}?next=${encodeURIComponent(back)}`);
  }

  try {
    switch (action) {
      /* ------------------------------------------------------------ friends -- */
      case 'friend-accept':
        await acceptFriendRequest(supabase, String(form.get('friendshipId') ?? ''));
        break;
      /*
       * Decline, unfriend and cancel-my-request are all the same row going
       * away — friendships has no 'declined' state, which is exactly why
       * blocking exists (see migration 0068). Three labels, one write.
       */
      case 'friend-remove':
        await removeFriendship(supabase, String(form.get('friendshipId') ?? ''));
        break;

      /* ------------------------------------------------------ notifications -- */
      case 'notifications-read-all':
        await markAllNotificationsRead(supabase, user.id);
        break;
      case 'notification-delete':
        await deleteNotification(supabase, String(form.get('notificationId') ?? ''));
        break;

      /* ----------------------------------------------------------- settings -- */
      case 'settings-profile': {
        /*
         * Empty is null, not "". A blank display name should mean "not set",
         * and the app reads these as nullable — an empty string would show as
         * a name made of nothing on every review the account has written.
         */
        const text = (key: string) => {
          const value = String(form.get(key) ?? '').trim();
          return value === '' ? null : value;
        };
        await updateProfile(supabase, user.id, {
          display_name: text('displayName'),
          bio: text('bio'),
        });
        break;
      }
      case 'settings-notifications': {
        const preferences: NotificationPreferences = {
          reviews: form.get('reviews') !== null,
          shares: form.get('shares') !== null,
          marketing: form.get('marketing') !== null,
          reminders: form.get('reminders') !== null,
        };
        await updateProfile(supabase, user.id, { notification_preferences: preferences });
        break;
      }
      case 'settings-locale': {
        /*
         * What the server writes to this person in, not what the site renders
         * in — the reminders are built by a scheduled job that cannot read a
         * cookie or a phone's storage. Constrained to the two we actually
         * send, so a hand-edited form cannot store a locale nothing speaks.
         */
        const locale = String(form.get('locale') ?? '');
        if (locale !== 'en' && locale !== 'sv') return redirect(`${back}?settingsError=1`);
        await updateProfile(supabase, user.id, { locale });
        break;
      }

      default:
        return new Response('Unknown action', { status: 400 });
    }
  } catch (error) {
    console.error('Account action failed', action, error);
    return redirect(`${back}?accountError=1`);
  }

  return redirect(`${back}?done=${action}`);
};
