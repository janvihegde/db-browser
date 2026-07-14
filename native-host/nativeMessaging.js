// nativeMessaging.js
//
// Chrome's native messaging protocol frames each JSON message with a 4-byte
// little-endian length prefix (of the UTF-8-encoded JSON payload) on both
// stdin and stdout. This module is the only place that framing logic lives;
// index.js just deals in plain JS objects.

function writeMessage(message) {
  const json = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(header);
  process.stdout.write(json);
}

// Calls onMessage(parsedObject) for each complete message read from stdin.
// Buffers partial reads across chunk boundaries, since a single stdin
// 'data' event has no guaranteed relationship to message boundaries.
function listen(onMessage, onError) {
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      if (buffer.length < 4) return; // not even a length prefix yet

      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) return; // full message not in yet

      const messageBuf = buffer.subarray(4, 4 + length);
      buffer = buffer.subarray(4 + length);

      try {
        const message = JSON.parse(messageBuf.toString('utf8'));
        onMessage(message);
      } catch (err) {
        onError?.(err);
      }
    }
  });

  process.stdin.on('end', () => {
    // Chrome closed the pipe — the browser process that owned this
    // connection is gone (tab closed, extension disabled, etc). Exit
    // cleanly rather than hanging as an orphaned process.
    process.exit(0);
  });
}

module.exports = { writeMessage, listen };
