import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchCrashCountSince,
  fetchFeedbackCountSince,
  fetchOpenReportsCount,
} from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';

/*
 * What the Admin menu has waiting, as three numbers.
 *
 * Only one of the three is a queue in the database sense. Reports carry a
 * status and stop being open when they are resolved, so counting them is
 * exact and self-clearing. Crashes and feedback carry no such column, on
 * purpose — a crash is a fact rather than a task, and `feedback` deliberately
 * records nothing about who sent what, so there is nowhere on the row to keep
 * one admin's idea of "read".
 *
 * Badging those two by their totals would have pinned a red number to the menu
 * that never went away, which teaches people to stop looking at badges at all.
 * So "new" means "arrived since this admin last opened that screen", and the
 * marker lives on the device. It is per-device rather than per-account, which
 * is the honest limitation: opening the feedback list on a phone does not clear
 * the badge on a tablet. That is acceptable for a signal whose only job is to
 * say "go and look", and the alternative is a migration to store read state
 * for a table designed to hold no identity at all.
 */
const SEEN_KEYS = {
  feedbackInbox: 'locastar.admin.seen.feedback',
  crashes: 'locastar.admin.seen.crashes',
} as const;

export type AdminAlertSurface = keyof typeof SEEN_KEYS;

export type AdminAlerts = {
  reports: number;
  feedbackInbox: number;
  crashes: number;
  /** What the single Admin row on the Profile screen shows. */
  total: number;
};

const NONE: AdminAlerts = { reports: 0, feedbackInbox: 0, crashes: 0, total: 0 };

/** Records that this admin has now looked at `surface`, clearing its badge. */
export async function markAdminSurfaceSeen(surface: AdminAlertSurface): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEYS[surface], new Date().toISOString());
  } catch {
    // Storage unavailable. The badge stays up, which is the safe direction to
    // fail: it nags, rather than hiding something that needs handling.
  }
}

/**
 * Counts for the Admin menu, refreshed whenever the calling screen is focused.
 *
 * `enabled` is what stops a signed-out or ordinary account querying three
 * moderator-only tables on every focus and collecting three RLS refusals.
 */
export function useAdminAlerts(enabled: boolean): AdminAlerts {
  const [alerts, setAlerts] = useState<AdminAlerts>(NONE);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setAlerts(NONE);
        return;
      }
      let cancelled = false;

      const load = async () => {
        const [feedbackSeen, crashesSeen] = await Promise.all([
          AsyncStorage.getItem(SEEN_KEYS.feedbackInbox).catch(() => null),
          AsyncStorage.getItem(SEEN_KEYS.crashes).catch(() => null),
        ]);
        // Settled rather than all: an admin who is not a superuser, or a table
        // that refuses, should cost that one number and not the other two.
        const [reports, feedbackInbox, crashes] = await Promise.all([
          fetchOpenReportsCount(supabase).catch(() => 0),
          fetchFeedbackCountSince(supabase, feedbackSeen).catch(() => 0),
          fetchCrashCountSince(supabase, crashesSeen).catch(() => 0),
        ]);
        if (cancelled) return;
        setAlerts({
          reports,
          feedbackInbox,
          crashes,
          total: reports + feedbackInbox + crashes,
        });
      };

      load().catch((err) => {
        // Leave the last known counts standing rather than zeroing them:
        // zero is a claim that there is nothing to handle, and a failed
        // request is not evidence of that.
        console.error('Failed to load admin alerts', err);
      });

      return () => {
        cancelled = true;
      };
    }, [enabled])
  );

  return alerts;
}
