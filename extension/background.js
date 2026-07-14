// background.js (MV3 service worker)
//
// Owns the single Native Messaging connection to the local host process.
// The content script forwards page requests here via chrome.runtime.sendMessage;
// this worker forwards them to the native host, matches responses back up by
// request id, and returns the result to the content script's callback.
//
// IMPORTANT: "com.dbbrowser.nativehost" must exactly match the "name" field
// in the native messaging host manifest that the installer registers with
// the OS/browser. See native-host-manifest.example.json.

const NATIVE_HOST_NAME = 'com.dbbrowser.nativehost';

// Native Messaging (chrome.runtime.connectNative) is a persistent port, not
// a one-shot request/response call, and a single service worker instance may
// juggle several in-flight page requests at once. We keep one native port
// per requesting tab (lazily created, reused) and match responses back to
// callers using the request `id` that flows all the way through.
const nativePortsByTab = new Map(); // tabId -> chrome.runtime.Port
const pendingByTab = new Map(); // tabId -> Map(requestId -> sendResponse callback)

function getOrCreateNativePort(tabId) {
  let port = nativePortsByTab.get(tabId);
  if (port) return port;

  port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
  nativePortsByTab.set(tabId, port);
  pendingByTab.set(tabId, new Map());

  port.onMessage.addListener((message) => {
    const pending = pendingByTab.get(tabId);
    
    // 1. Match using requestId instead of id
    const sendResponse = pending?.get(message.requestId);
    if (!sendResponse) return; 
    pending.delete(message.requestId);

    // 2. Translate native host response into the format the content script expects
    sendResponse({
      ok: !message.error,        // If there's no error, it's successful
      data: message.result,      // native-host uses 'result'
      error: message.error,      // native-host uses 'error' string
    });
  });   

  port.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError?.message || 'Native host disconnected';
    const pending = pendingByTab.get(tabId);
    if (pending) {
      for (const sendResponse of pending.values()) {
        sendResponse({ ok: false, error: err });
      }
    }
    nativePortsByTab.delete(tabId);
    pendingByTab.delete(tabId);
  });

  return port;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return false;

  const { id, type, payload } = message;

  try {
    const port = getOrCreateNativePort(tabId);
    pendingByTab.get(tabId).set(id, sendResponse);
    
    // ✅ Translate the page structure into what native-host destructures
    port.postMessage({ 
      requestId: id, 
      type: type, 
      connection: payload?.connection,
      params: payload?.params || {}
    });
    
  } catch (err) {
    sendResponse({ ok: false, error: err?.message || 'Failed to reach native host' });
    return false;
  }

  // Returning true keeps sendResponse alive for the async native reply.
  return true;
});

// Clean up if a tab closes mid-request.
chrome.tabs.onRemoved.addListener((tabId) => {
  const port = nativePortsByTab.get(tabId);
  if (port) port.disconnect();
  nativePortsByTab.delete(tabId);
  pendingByTab.delete(tabId);
});