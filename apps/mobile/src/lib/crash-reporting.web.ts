/**
 * The web build reports nothing.
 *
 * ErrorUtils is a React Native global and does not exist in a browser, so the
 * native version would do nothing useful here — but "nothing useful" is not the
 * reason for a separate file. The reason is that the root layout is exactly
 * where a web-hostile import took the whole site down once already:
 * useLastNotificationResponse threw during the first render and every page of
 * locastar.se served an empty <div id="root">, invisible to every check that
 * only fetched the markup.
 *
 * So anything the root layout calls gets a web stub deliberately, rather than a
 * guard inside a shared file that has to keep being right.
 *
 * If the site ever becomes worth instrumenting, window.onerror is the hook —
 * but the current site is a placeholder awaiting the real one.
 */
export function installCrashReporter(): void {
  // Deliberately empty.
}

export function setCrashRoute(_route: string | null): void {
  // Deliberately empty.
}
