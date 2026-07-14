// Runs inside the db-browser-one.vercel.app page. The page can't talk to
// native messaging directly — only extension code can — so this script
// relays messages between window.postMessage (page side) and
// chrome.runtime.sendMessage (extension side).

const SOURCE_TAG = 'db-browser-page';
const REPLY_TAG = 'db-browser-extension';

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== SOURCE_TAG) return;

  const { requestId, payload } = event.data;

  chrome.runtime.sendMessage(payload, (response) => {
    if (chrome.runtime.lastError) {
      window.postMessage({
        source: REPLY_TAG,
        requestId,
        error: chrome.runtime.lastError.message || 'Extension not reachable'
      }, '*');
      return;
    }
    window.postMessage({ source: REPLY_TAG, requestId, response }, '*');
  });
});

// Lets the page detect "is the extension installed?" before trying to use it.
window.postMessage({ source: REPLY_TAG, requestId: '__extension_ready__' }, '*');