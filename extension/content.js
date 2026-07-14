// content.js
//
// Runs in an "isolated world" alongside the page, so it can't call the
// page's JS directly and the page can't call chrome.* APIs directly either.
// This bridges window.postMessage (used by db-browser-frontend/src/services/
// extensionBridge.js) to chrome.runtime messaging (used by background.js).
//
// This protocol is dictated by extensionBridge.js — don't change the shapes
// below without updating that file too.
//
// Page -> content script (window.postMessage):
//   { source: 'db-browser-page', requestId, payload: { requestId, type, connection, params } }
//
// Content script -> page (window.postMessage reply):
//   { source: 'db-browser-extension', requestId, response: { result, error } }
//   { source: 'db-browser-extension', requestId: '__extension_ready__' }  (sent once, on load)

const PAGE_SOURCE = 'db-browser-page';
const EXTENSION_SOURCE = 'db-browser-extension';

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.source !== PAGE_SOURCE) return;

  const { requestId, payload } = msg;

  chrome.runtime.sendMessage(payload, (response) => {
    if (chrome.runtime.lastError) {
      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          requestId,
          response: { error: chrome.runtime.lastError.message || 'Extension messaging error' },
        },
        window.location.origin
      );
      return;
    }

    window.postMessage(
      { source: EXTENSION_SOURCE, requestId, response },
      window.location.origin
    );
  });
});

// Tell extensionBridge.js the extension is installed and alive.
window.postMessage(
  { source: EXTENSION_SOURCE, requestId: '__extension_ready__' },
  window.location.origin
);
