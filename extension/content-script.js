// content.js
//
// Runs in an "isolated world" alongside the page, so it can't call the
// page's JS directly and the page can't call chrome.* APIs directly either.
// This script is the bridge: it listens for messages the page posts on
// `window`, forwards them to the background service worker (which owns the
// native messaging connection), and posts the response back to the page.
//
// Message shape going OUT of the page (page -> content script):
//   { source: 'db-browser-page', id: string, type: string, payload: any }
//
// Message shape coming BACK from the extension (content script -> page):
//   { source: 'db-browser-extension', id: string, ok: boolean, data?: any, error?: string }

const PAGE_SOURCE = 'db-browser-page';
const EXTENSION_SOURCE = 'db-browser-extension';

window.addEventListener('message', (event) => {
  // Only accept messages from this same window (not iframes/other origins),
  // and only messages tagged as coming from our page-side client code.
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.source !== PAGE_SOURCE) return;

  const { id, type, payload } = msg;

  chrome.runtime.sendMessage({ id, type, payload }, (response) => {
    if (chrome.runtime.lastError) {
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          id,
          ok: false,
          error: chrome.runtime.lastError.message || 'Extension messaging error',
        },
        window.location.origin
      );
      return;
    }

    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        id,
        ok: response?.ok ?? false,
        data: response?.data,
        error: response?.error,
      },
      window.location.origin
    );
  });
});

// Let the page know the extension is actually installed and this content
// script is alive, so the frontend can show "connector detected" vs.
// "please install the extension".
window.postMessage({ source: EXTENSION_SOURCE, id: '__ready__', ok: true }, window.location.origin);
