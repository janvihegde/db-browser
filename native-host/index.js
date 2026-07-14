#!/usr/bin/env node
// index.js — native messaging host entry point.
//
// Chrome launches this process (per the path registered in the native
// messaging host manifest — see README.md) and talks to it over stdin/
// stdout using the length-prefixed JSON framing implemented in
// nativeMessaging.js. Every message in is { requestId, type, connection,
// params }; every message out is { requestId, result } or
// { requestId, error }.

const { listen, writeMessage } = require('./nativeMessaging');
const handlers = require('./handlers');

listen(
  async (message) => {
    const { requestId, type, connection, params } = message;

    const handler = handlers[type];
    if (!handler) {
      writeMessage({ requestId, error: `Unknown request type: "${type}"` });
      return;
    }

    try {
      const result = await handler(connection, params || {});
      writeMessage({ requestId, result });
    } catch (err) {
      writeMessage({ requestId, error: err.message || 'Unexpected native host error' });
    }
  },
  (parseErr) => {
    // A malformed frame from the extension side — log to stderr (never
    // stdout, which is reserved for the framed protocol) and keep running.
    console.error('Failed to parse incoming message:', parseErr.message);
  }
);

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in native host:', err);
});
