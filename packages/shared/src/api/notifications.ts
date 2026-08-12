import type { SupabaseClient } from "@supabase/supabase-js";

export type ShareNotificationPayload = {
  location_id: string;
  location_name: string | null;
  sender_name: string;
  note: string | null;
};

export type ListShareNotificationPayload = {
  list_id: string;
  list_name: string | null;
  sender_name: string;
};

export type RoleGrantedNotificationPayload = {
  role: string;
};

export type FriendNotificationPayload = {
  friendship_id: string;
  /** The other person: who sent the request, or who accepted it. */
  sender_name: string;
};

/**
 * Written by claim_activity_reminders alongside the push, so the reminder
 * survives being swiped away or arriving on a phone you don't pick up.
 */
export type ActivityReminderNotificationPayload = {
  location_id: string;
  location_name: string | null;
  starts_at: string;
};

export type Notification =
  | {
      id: string;
      type: "share";
      payload: ShareNotificationPayload;
      readAt: string | null;
      createdAt: string;
    }
  | {
      id: string;
      type: "list_share";
      payload: ListShareNotificationPayload;
      readAt: string | null;
      createdAt: string;
    }
  | {
      id: string;
      type: "role_granted";
      payload: RoleGrantedNotificationPayload;
      readAt: string | null;
      createdAt: string;
    }
  | {
      id: string;
      type: "friend_request";
      payload: FriendNotificationPayload;
      readAt: string | null;
      createdAt: string;
    }
  | {
      id: string;
      type: "friend_accepted";
      payload: FriendNotificationPayload;
      readAt: string | null;
      createdAt: string;
    }
  | {
      id: string;
      type: "activity_reminder";
      payload: ActivityReminderNotificationPayload;
      readAt: string | null;
      createdAt: string;
    };

type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotifications(client: SupabaseClient, userId: string): Promise<Notification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  })) as Notification[];
}

export async function fetchUnreadNotificationCount(client: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(client: SupabaseClient, notificationId: string): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function deleteNotification(client: SupabaseClient, notificationId: string): Promise<void> {
  const { error } = await client.from("notifications").delete().eq("id", notificationId);
  if (error) throw error;
}

/**
 * Clears the whole list at once, rather than one tap per row.
 *
 * Scoped by user_id even though RLS already restricts the table to the caller:
 * an unfiltered `delete()` is one policy mistake away from clearing everyone's
 * notifications, and PostgREST is happy to issue it.
 */
export async function deleteAllNotifications(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from("notifications").delete().eq("user_id", userId);
  if (error) throw error;
}
