// Talks to the DB Browser Local Bridge extension via window.postMessage.
// The extension's content script relays these to the native host, which
// opens the real Postgres connection on the user's own machine.

const SOURCE_TAG = 'db-browser-page';
const REPLY_TAG = 'db-browser-extension';

const pending = new Map();
let extensionDetected = false;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== REPLY_TAG) return;

  const { requestId, response, error } = event.data;

  if (requestId === '__extension_ready__') {
    extensionDetected = true;
    return;
  }

  const handler = pending.get(requestId);
  if (!handler) return;
  pending.delete(requestId);

  if (error) return handler.reject(new Error(error));
  if (response && response.error) return handler.reject(new Error(response.error));
  handler.resolve(response ? response.result : undefined);
});

function isExtensionAvailable() {
  return extensionDetected;
}

// Polls briefly instead of checking once - the extension's "ready" ping
// fires asynchronously right after page load, so a single synchronous
// check can catch it a few milliseconds too early and wrongly report
// "not installed" even when it genuinely is.
function waitUntilAvailable(timeoutMs = 1000) {
  if (extensionDetected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const interval = setInterval(() => {
      if (extensionDetected) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 50);
  });
}

function callExtension(type, connection, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pending.set(requestId, { resolve, reject });

    window.postMessage({
      source: SOURCE_TAG,
      requestId,
      payload: { requestId, type, connection, params }
    }, '*');

    setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        reject(new Error('No response from the local extension. Is it installed and enabled?'));
      }
    }, 10000);
  });
}

export const extensionApi = {
  isAvailable: isExtensionAvailable,
  waitUntilAvailable,
  testConnection: (connection) => callExtension('test', connection),
  listDatabases: (connection) => callExtension('listDatabases', connection),
  listSchemas: (connection, db) => callExtension('listSchemas', connection, { db }),
  listTables: (connection, db, schema) => callExtension('listTables', connection, { db, schema }),
  listColumns: (connection, db, schema, table) => callExtension('listColumns', connection, { db, schema, table }),
  previewTable: (connection, db, schema, table) => callExtension('previewTable', connection, { db, schema, table }),
  runQuery: (connection, db, sql) => callExtension('runQuery', connection, { db, sql }),
};