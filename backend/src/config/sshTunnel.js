const { EventEmitter } = require('events');
const { Client } = require('ssh2');

// ---------------------------------------------------------------------------
// Why this file exists
// ---------------------------------------------------------------------------
// The Postgres instance sits in a private network only reachable by SSH-ing
// into a bastion/jump EC2 host first (`ssh -L localPort:rdsHost:5432
// user@bastion`, done manually by every engineer today). This module does
// the same thing from the backend itself: it opens an SSH connection to the
// bastion and forwards a virtual channel to the DB host/port, then hands
// that channel to `pg` as if it were a normal TCP socket. No local install,
// no browser extension — the backend is the one "running SSH".
//
// `pg` supports a `stream` config option that can be a factory function; it
// calls `stream(config)` once per physical connection it opens (Pool calls
// this once per pooled client) and expects back an object that behaves like
// a not-yet-connected net.Socket: it must expose setNoDelay/connect/write/
// end/ref/unref and emit 'connect' | 'data' | 'error' | 'close'.
// TunneledSocket below is that wrapper around an SSH-forwarded channel.
// ---------------------------------------------------------------------------

class TunneledSocket extends EventEmitter {
  constructor(getSshClient, targetHost, targetPort) {
    super();
    this.getSshClient = getSshClient;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
    this.channel = null;
  }

  // pg calls this before writing/reading; an SSH channel has no TCP-level
  // Nagle setting to toggle, so this is intentionally a no-op.
  setNoDelay() {}

  // pg calls `.connect(port, host)` using ITS OWN config's host/port. We
  // ignore those args deliberately — the real destination is fixed to
  // targetHost/targetPort, resolved once via the SSH tunnel below.
  connect() {
    this.getSshClient()
      .then((sshClient) => {
        sshClient.forwardOut(
          '127.0.0.1', 0,
          this.targetHost, this.targetPort,
          (err, channel) => {
            if (err) {
              this.emit('error', new Error(`SSH tunnel forward to ${this.targetHost}:${this.targetPort} failed: ${err.message}`));
              return;
            }
            this.channel = channel;
            channel.on('data', (data) => this.emit('data', data));
            channel.on('error', (chErr) => this.emit('error', chErr));
            channel.on('close', () => this.emit('close'));
            this.emit('connect');
          }
        );
      })
      .catch((err) => this.emit('error', err));
  }

  write(data, cb) {
    if (!this.channel) return false;
    return this.channel.write(data, cb);
  }

  end() {
    if (this.channel) this.channel.end();
  }

  ref() {}
  unref() {}
}

// ---------------------------------------------------------------------------
// Persistent tunnels — one SSH connection per saved connection id, reused
// across every pooled `pg` client so we're not opening a new SSH session
// per query. Individual pg connections are separate multiplexed channels
// over this one SSH session (exactly like a single `ssh -L` session can
// carry many simultaneous local connections).
// ---------------------------------------------------------------------------

const persistentSshConnections = new Map(); // connectionId -> Promise<ssh2.Client>

function getPersistentSshClient(dbConnection) {
  const key = dbConnection.id;
  if (persistentSshConnections.has(key)) {
    return persistentSshConnections.get(key);
  }

  const promise = new Promise((resolve, reject) => {
    const client = new Client();
    client
      .on('ready', () => resolve(client))
      .on('error', (err) => {
        persistentSshConnections.delete(key); // never cache a broken/dead connection
        reject(new Error(`SSH connection to bastion failed: ${err.message}`));
      })
      .on('close', () => {
        persistentSshConnections.delete(key); // force a fresh SSH session on next use
      })
      .connect({
        host: dbConnection.bastion_host,
        port: dbConnection.bastion_port || 22,
        username: dbConnection.bastion_user,
        password: dbConnection.bastion_password, // must already be decrypted by the caller
        readyTimeout: 8000,
        keepaliveInterval: 15000
      });
  });

  persistentSshConnections.set(key, promise);
  return promise;
}

// Used by `getUserPool` (see config/db.js) as the `stream` option whenever a
// saved connection has bastion details set.
function persistentTunnelStreamFactory(dbConnection) {
  return () => new TunneledSocket(
    () => getPersistentSshClient(dbConnection),
    dbConnection.host,
    Number(dbConnection.port)
  );
}

// ---------------------------------------------------------------------------
// Ad-hoc tunnel — used only by the "Test Connection" button, before a
// connection has an id / has been saved. Opens one throwaway SSH session,
// used for exactly one pg connection attempt, then torn down.
// ---------------------------------------------------------------------------

function adHocTunnelStreamFactory(bastionConfig, dbHost, dbPort) {
  let sshClientPromise = null;

  function getSshClient() {
    if (sshClientPromise) return sshClientPromise;
    sshClientPromise = new Promise((resolve, reject) => {
      const client = new Client();
      client
        .on('ready', () => resolve(client))
        .on('error', (err) => reject(new Error(`SSH connection to bastion failed: ${err.message}`)))
        .connect({
          host: bastionConfig.bastionHost,
          port: bastionConfig.bastionPort || 22,
          username: bastionConfig.bastionUser,
          password: bastionConfig.bastionPassword,
          readyTimeout: 8000
        });
    });
    return sshClientPromise;
  }

  return {
    streamFactory: () => {
      const socket = new TunneledSocket(getSshClient, dbHost, Number(dbPort));
      // Tear down the throwaway SSH session once this one-off channel closes,
      // so a failed/completed test never leaves a dangling SSH connection.
      socket.on('close', () => {
        if (sshClientPromise) sshClientPromise.then((c) => c.end()).catch(() => {});
      });
      return socket;
    },
    cleanup: () => {
      if (sshClientPromise) sshClientPromise.then((c) => c.end()).catch(() => {});
    }
  };
}

module.exports = { persistentTunnelStreamFactory, adHocTunnelStreamFactory };