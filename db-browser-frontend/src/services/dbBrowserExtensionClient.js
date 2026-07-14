// dbBrowserExtensionClient.js
//
// Drop this into db-browser-frontend/src/services/ alongside api.js.
// It's the page-side half of the protocol implemented by content.js —
// the Vercel-hosted app calls these functions instead of hitting the old
// Render backend for anything that needs the local database connection.

const PAGE_SOURCE = 'db-browser-page';
const EXTENSION_SOURCE = 'db-browser-extension';

const pending = new Map(); // requestId -> { resolve, reject }
let readyPromise = null;

function listen() {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== EXTENSION_SOURCE) return;

    if (msg.id === '__ready__') {
      resolveReady();
      return;
    }

    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);

    if (msg.ok) entry.resolve(msg.data);
    else entry.reject(new Error(msg.error || 'Extension request failed'));
  });
}

let resolveReady;
function ensureReadyPromise() {
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });
    listen();
  }
  return readyPromise;
}

/**
 * Resolves once the content script has announced itself. Use this to show
 * "connector detected" vs. "please install the extension" in the UI.
 * Times out (rejects) if nothing responds — that means the extension isn't
 * installed or isn't matched to this page's origin.
 */
export function waitForExtension(timeoutMs = 1500) {
  const ready = ensureReadyPromise();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DB Browser extension not detected')), timeoutMs)
  );
  return Promise.race([ready, timeout]);
}

/**
 * Sends a request to the native host via the extension and resolves with
 * its response. `type` and `payload` are whatever shape the native host
 * expects for that request — see the protocol section in the README
 * (e.g. type: 'connect' | 'query' | 'schema' | 'disconnect').
 */
export function sendToExtension(type, payload) {
  ensureReadyPromise();
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    window.postMessage({ source: PAGE_SOURCE, id, type, payload }, window.location.origin);

    // Guard against a request that never gets a reply (extension removed
    // mid-session, native host crashed, etc).
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Request "${type}" timed out waiting for the extension`));
      }
    }, 30000);
  });
}

// Example usage from a component:
//
//   import { sendToExtension, waitForExtension } from '../services/dbBrowserExtensionClient';
//
//   await waitForExtension();
//   const rows = await sendToExtension('query', { connectionId, sql: 'select * from users limit 100' });
