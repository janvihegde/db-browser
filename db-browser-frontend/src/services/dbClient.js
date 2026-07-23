import api from './api';
import { extensionApi } from './extensionBridge';

// Local connections (host is on the user's own machine) never touch the
// hosted backend — their credentials only ever travel from this browser to
// the local extension/native host, per the "no cross-device sync, per-device
// only" decision in the architecture doc. They're kept in localStorage and
// tagged with a "local-" id prefix so the rest of the app can tell them
// apart from server-side connections without threading an extra flag
// through every call.
//
// NOTE ON SECURITY: this means local-connection passwords sit in this
// browser's localStorage in plaintext. That's an accepted tradeoff of
// "no hosted metadata service for local connections," not an oversight —
// but it's worth knowing if this ever needs to satisfy a stricter threat
// model (e.g. shared/managed machines).

const LOCAL_CONNECTIONS_KEY = 'db_browser_local_connections';

function loadLocalConnections() {
  try {
    const raw = localStorage.getItem(LOCAL_CONNECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalConnections(list) {
  localStorage.setItem(LOCAL_CONNECTIONS_KEY, JSON.stringify(list));
}

function isLocalId(id) {
  return typeof id === 'string' && id.startsWith('local-');
}

function getLocalConnection(id) {
  const conn = loadLocalConnections().find((c) => c.id === id);
  if (!conn) {
    throw new Error('Local connection not found. It may have been removed on this device.');
  }
  return conn;
}

// Normalizes server-shape (snake_case) and local-shape (camelCase, from the
// ConnectionManager form) connections into one consistent shape for display.
function toDisplayShape(conn, isLocal) {
  return {
    id: conn.id,
    label: conn.label,
    host: conn.host,
    port: conn.port,
    db_user: conn.dbUser ?? conn.db_user,
    database_name: conn.databaseName ?? conn.database_name,
    ssl_reject_unauthorized: !!(conn.sslRejectUnauthorized ?? conn.ssl_reject_unauthorized),
    created_at: conn.created_at || conn.createdAt,
    isLocal,
  };
}

export const dbClient = {
  // ---------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------
  async listConnections() {
    const remote = await api
      .get('/connections')
      .then((res) => res.data.connections)
      .catch(() => []); // don't let a Render hiccup hide locally-saved connections

    const local = loadLocalConnections();

    return [
      ...local.map((c) => toDisplayShape(c, true)),
      ...remote.map((c) => toDisplayShape(c, false)),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async testConnection(form, isLocal) {
    if (isLocal) {
      if (!(await extensionApi.waitUntilAvailable(1000))) {
        throw new Error('Extension not detected. Install the DB Browser Local Bridge extension on this computer first, then reload this page.');
      }
      return extensionApi.testConnection(form);
    }
    const res = await api.post('/connections/test', form);
    return res.data;
  },

  async saveConnection(form, editingId, isLocal) {
    if (isLocal) {
      const list = loadLocalConnections();
      const idx = editingId ? list.findIndex((c) => c.id === editingId) : -1;
      if (idx !== -1) {
        // Editing a connection that was already local.
        list[idx] = {
          ...list[idx],
          ...form,
          // Blank password on edit means "keep the existing one"
          dbPassword: form.dbPassword?.trim() ? form.dbPassword : list[idx].dbPassword,
        };
        saveLocalConnections(list);
        return { id: editingId };
      }

      // Either a brand new connection, or an existing HOSTED connection
      // being converted to local for the first time (editingId points at
      // a server-side row, not a local one - it'll never be found above).
      // Either way, create a fresh local entry.
      const newId = `local-${crypto.randomUUID()}`;
      list.push({
        ...form,
        id: newId,
        created_at: new Date().toISOString(),
      });
      saveLocalConnections(list);

      // If this was converting an existing hosted connection, remove the
      // old server-side row so it doesn't linger as a separate, permanently
      // broken duplicate (it can never work as a hosted connection if the
      // host is the user's own machine).
      if (editingId && !String(editingId).startsWith('local-')) {
        try {
          await api.delete(`/connections/${editingId}`);
        } catch (err) {
          console.error('Could not remove the old hosted connection after converting it to local:', err);
        }
      }

      return { id: newId };
    }

    if (editingId) {
      await api.put(`/connections/${editingId}`, form);
      return { id: editingId };
    }
    const res = await api.post('/connections', form);
    return { id: res.data?.connection?.id };
  },

  async deleteConnection(id) {
    if (isLocalId(id)) {
      saveLocalConnections(loadLocalConnections().filter((c) => c.id !== id));
      return;
    }
    await api.delete(`/connections/${id}`);
  },

  // ---------------------------------------------------------------------
  // Data browsing — local connections go through the extension, everything
  // else goes through the existing Render backend.
  // ---------------------------------------------------------------------
  async listDatabases(connectionId) {
    if (isLocalId(connectionId)) {
      const res = await extensionApi.listDatabases(getLocalConnection(connectionId));
      return res.databases;
    }
    const res = await api.get(`/database/${connectionId}/list`);
    return res.data.databases;
  },

  async listSchemas(connectionId, db) {
    if (isLocalId(connectionId)) {
      const res = await extensionApi.listSchemas(getLocalConnection(connectionId), db);
      return res.schemas;
    }
    const res = await api.get(`/database/${connectionId}/${db}/schemas`);
    return res.data.schemas;
  },

  async listTables(connectionId, db, schema) {
    if (isLocalId(connectionId)) {
      const res = await extensionApi.listTables(getLocalConnection(connectionId), db, schema);
      return res.tables;
    }
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables`);
    return res.data.tables;
  },

  async listColumns(connectionId, db, schema, table) {
    if (isLocalId(connectionId)) {
      const res = await extensionApi.listColumns(getLocalConnection(connectionId), db, schema, table);
      return res.columns;
    }
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/columns`);
    return res.data.columns;
  },

  async previewTable(connectionId, db, schema, table) {
    if (isLocalId(connectionId)) {
      const res = await extensionApi.previewTable(getLocalConnection(connectionId), db, schema, table);
      return res.data;
    }
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/preview`);
    return res.data.data;
  },

  async getRowCount(connectionId, db, schema, table) {
    if (isLocalId(connectionId)) {
      // Not exposed by the extension bridge yet — surface as "unknown"
      // rather than a thrown error, since App/TableWorkspace treat this as
      // an optional badge, not a required value.
      return null;
    }
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/count`);
    return res.data.rowCount;
  },

  async getRelationships(connectionId, db, schema, table) {
    if (isLocalId(connectionId)) {
      throw new Error('Relationships are not yet supported for local connections.');
    }
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/relationships`);
    return res.data;
  },

  async runQuery(connectionId, db, sql) {
    if (isLocalId(connectionId)) {
      const res = await extensionApi.runQuery(getLocalConnection(connectionId), db, sql);
      return res.data;
    }
    const res = await api.post(`/database/${connectionId}/${db}/query`, { sql });
    return res.data.data ?? res.data.rows;
  },

  async search(connectionId, db, term) {
    if (isLocalId(connectionId)) {
      throw new Error('Search is not yet supported for local connections.');
    }
    const res = await api.get(`/database/${connectionId}/${db}/search`, { params: { q: term } });
    return res.data;
  },

  isLocalId,
};