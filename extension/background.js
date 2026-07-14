// Forwards each request from the content script to the native host process
// (native-host.js, running locally) and returns its response. Each call is
// a fresh request/response round trip — the native host itself manages any
// database connection pooling.

const NATIVE_HOST_NAME = 'com.dbbrowser.nativehost';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        error: `Couldn't reach the local helper: ${chrome.runtime.lastError.message}. Is it installed?`
      });
      return;
    }
    sendResponse(response);
  });

  return true; // keep sendResponse alive for the async native messaging call
});