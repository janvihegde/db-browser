// background.js (MV3 service worker)
//
// Owns the single Native Messaging connection to the local host process.
// content.js forwards the page's { requestId, type, connection, params }
// payload here via chrome.runtime.sendMessage; this worker forwards it to
// the native host over stdio, matches the reply back by `requestId`, and
// calls the content script's sendResponse with { result, error }.
//
// IMPORTANT: "com.dbbrowser.nativehost" must exactly match the "name" field
// in the native messaging host manifest the installer registers with the
// OS/browser (see native-host-manifest.example.json / native-host/README.md).

const NATIVE_HOST_NAME = 'com.dbbrowser.nativehost';

// One native port per tab, lazily created and reused; several page requests
// can be in flight on the same port at once, matched back up by requestId.
const nativePortsByTab = new Map(); // tabId -> chrome.runtime.Port
const pendingByTab = new Map(); // tabId -> Map(requestId -> sendResponse)

function getOrCreateNativePort(tabId) {
  let port = nativePortsByTab.get(tabId);
  if (port) return port;

  port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
  nativePortsByTab.set(tabId, port);
  pendingByTab.set(tabId, new Map());

  port.onMessage.addListener((message) => {
    const pending = pendingByTab.get(tabId);
    const sendResponse = pending?.get(message.requestId);
    if (!sendResponse) return; // unmatched or late reply, drop it
    pending.delete(message.requestId);

    sendResponse({ result: message.result, error: message.error });
  });

  port.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError?.message || 'Native host disconnected';
    const pending = pendingByTab.get(tabId);
    if (pending) {
      for (const sendResponse of pending.values()) {
        sendResponse({ error: err });
      }
    }
    nativePortsByTab.delete(tabId);
    pendingByTab.delete(tabId);
  });

  return port;
}

chrome.runtime.onMessage.addListener((payload, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined || !payload?.requestId) return false;

  try {
    const port = getOrCreateNativePort(tabId);
    pendingByTab.get(tabId).set(payload.requestId, sendResponse);
    port.postMessage(payload); // { requestId, type, connection, params }
  } catch (err) {
    sendResponse({ error: err?.message || 'Failed to reach native host' });
    return false;
  }

  return true; // keep sendResponse alive for the async native reply
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const port = nativePortsByTab.get(tabId);
  if (port) port.disconnect();
  nativePortsByTab.delete(tabId);
  pendingByTab.delete(tabId);
});
