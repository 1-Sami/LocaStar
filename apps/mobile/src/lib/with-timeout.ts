/**
 * Gives up on a request that is never going to answer.
 *
 * Nothing in the Supabase client has a deadline, and on a phone with no signal
 * a query does not fail — it hangs, sometimes for a minute, until the OS gives
 * up on the socket. Every screen here waits on a `.finally` to stop its
 * spinner, so a hang is not a slow screen, it is a screen that never arrives:
 * the place page sat on its loading view, which is a bare ThemedView and
 * therefore black on the dark theme, and looked like a crash.
 *
 * Deliberately applied at the call sites that load a screen rather than by
 * replacing the client's `fetch`. A global deadline would also cover photo
 * uploads, which are legitimately slow on a poor connection and must not be
 * cut off at twelve seconds.
 *
 * The underlying request is not aborted, only stopped being waited on. There
 * is nothing to cancel usefully — a read that lands late is simply ignored,
 * and the screens already guard their own setState with a cancelled flag.
 */
export const REQUEST_TIMEOUT_MS = 12_000;

export class RequestTimeout extends Error {
  constructor() {
    super('The request took too long');
    this.name = 'RequestTimeout';
  }
}

export function withTimeout<T>(work: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeout()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
