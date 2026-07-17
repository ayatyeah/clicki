/**
 * "Install the app" plumbing.
 *
 * The site has been installable for a while — manifest, service worker, icons,
 * `start_url: /app` that drops a signed-in creator straight into their cabinet —
 * and nobody could tell, because the only way in was a menu item buried in the
 * browser. This is the missing half.
 *
 * Chrome fires `beforeinstallprompt` once, early, and only hands us the event if
 * we call preventDefault() on it; keep it and we can open the real install
 * dialog later from a real click. It fires long before a creator opens their
 * account tab, and the cabinet is a lazy chunk, so the event is caught at app
 * start (App.jsx) and parked here for whoever asks.
 *
 * Safari never fires it at all. On iOS installing is a manual Share → «На экран
 * «Домой»», so there is nothing to call — the button has to teach the gesture
 * instead. Note the installed iOS app gets its own storage, separate from
 * Safari's, so a creator logged in in the browser still logs in once inside the
 * app. Nothing here can change that; the copy just shouldn't promise otherwise.
 */

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function initInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Without this Chrome shows its own mini-infobar and keeps the event; with
    // it, the moment of asking is ours to pick.
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** Subscribe to "can we prompt now?" changes. Returns an unsubscribe. */
export function onInstallAvailability(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const canPromptInstall = () => !!deferred;

/**
 * Open the browser's install dialog. The event is single-use — spent whether the
 * creator accepts or dismisses — so it is dropped before awaiting the choice.
 */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null;
  notify();
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome; // 'accepted' | 'dismissed'
}

/** Already running as the installed app — then there is nothing to offer. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/** iOS: no prompt API, and Add to Home Screen is a manual gesture. */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ calls itself a Mac; the touch points are what give it away.
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** On iOS only Safari can add to the home screen — Chrome and Firefox there can't. */
export function isIosSafari() {
  return isIos() && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
}
