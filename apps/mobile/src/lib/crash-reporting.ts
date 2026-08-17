import { reportCrash } from '@locastar/shared';
import { Platform } from 'react-native';

import { APP_RELEASE } from '@/constants/release';
import { supabase } from '@/lib/supabase';

/**
 * Sends uncaught JavaScript errors somewhere a human will see them.
 *
 * Not Sentry. Sentry is a native module, so it cannot arrive over the air and
 * would have to wait for the next binary — and until then nothing at all
 * reports crashes, which is the situation this exists to end. Most crashes in
 * an Expo app are JavaScript, and those are exactly what ErrorUtils catches.
 * When a binary is next built, this is worth replacing rather than keeping.
 *
 * What it deliberately does not do: identify anybody. No user id, no device id.
 * The Privacy Policy does not claim to collect diagnostics, and a column that
 * quietly made it untrue would be worse than having no reports at all.
 */

/*
 * A crash loop must not become a write loop.
 *
 * An app that throws on every render would otherwise file a report per frame,
 * and the first thing anyone would learn from the table is that it is full.
 * Repeats of the same message are dropped, and the whole session is capped.
 */
const MAX_REPORTS_PER_SESSION = 10;
let reportsSent = 0;
const seen = new Set<string>();

/** Set by the navigation tree so a report can say where it happened. */
let currentRoute: string | null = null;

export function setCrashRoute(route: string | null): void {
  currentRoute = route;
}

function send(error: unknown, isFatal: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;

  const key = `${message}::${isFatal}`;
  if (seen.has(key) || reportsSent >= MAX_REPORTS_PER_SESSION) return;
  seen.add(key);
  reportsSent += 1;

  // Not awaited: the handler that called this is on its way to tearing the app
  // down, and blocking it to finish an insert would only delay the crash.
  void reportCrash(supabase, {
    appRelease: APP_RELEASE,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    osVersion: String(Platform.Version),
    route: currentRoute,
    message,
    stack,
    isFatal,
  });
}

export function installCrashReporter(): void {
  /*
   * Skipped in development. Every half-finished edit would otherwise land in
   * the table and bury the reports that came from real phones.
   */
  if (__DEV__) return;

  const globalWithErrorUtils = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
      setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const errorUtils = globalWithErrorUtils.ErrorUtils;
  if (!errorUtils) return;

  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    send(error, isFatal ?? true);
    // Chained, never replaced. Swallowing the error here would stop the app
    // crashing the way it is supposed to and hide it from the platform's own
    // reporting as well as from the developer's red box.
    previous?.(error, isFatal);
  });
}
