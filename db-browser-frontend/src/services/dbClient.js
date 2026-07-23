import api from './api';

// Every connection now goes through the hosted backend, which reaches the
// database directly or (when bastion_host is set on the saved connection)
// via an SSH tunnel it opens itself. There's no more "local" connection
// type and no browser extension/native host involved.

function toDisplayShape(conn) {
  return {
    id: conn.id,
    label: conn.label,
    host: conn.host,
    port: conn.port,
    db_user: conn.dbUser ?? conn.db_user,
    database_name: conn.databaseName ?? conn.database_name,
    ssl_reject_unauthorized: !!(conn.sslRejectUnauthorized ?? conn.ssl_reject_unauthorized),
    bastion_host: conn.bastionHost ?? conn.bastion_host ?? null,
    bastion_port: conn.bastionPort ?? conn.bastion_port ?? null,
    bastion_user: conn.bastionUser ?? conn.bastion_user ?? null,
    created_at: conn.created_at || conn.createdAt,
  };
}

export const dbClient = {
  // ---------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------
  async listConnections() {
    const { data } = await api.get('/connections');
    return data.connections
      .map(toDisplayShape)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async testConnection(form) {
    const res = await api.post('/connections/test', form);
    return res.data;
  },

  async saveConnection(form, editingId) {
    if (editingId) {
      await api.put(`/connections/${editingId}`, form);
    } else {
      await api.post('/connections', form);
    }
  },

  async deleteConnection(id) {
    await api.delete(`/connections/${id}`);
  },

  // ---------------------------------------------------------------------
  // Data browsing — always through the hosted backend now.
  // ---------------------------------------------------------------------
  async listDatabases(connectionId) {
    const res = await api.get(`/database/${connectionId}/list`);
    return res.data.databases;
  },

  async listSchemas(connectionId, db) {
    const res = await api.get(`/database/${connectionId}/${db}/schemas`);
    return res.data.schemas;
  },

  async listTables(connectionId, db, schema) {
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables`);
    return res.data.tables;
  },

  async listColumns(connectionId, db, schema, table) {
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/columns`);
    return res.data.columns;
  },

  async previewTable(connectionId, db, schema, table) {
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/preview`);
    return res.data.data;
  },

  async getRowCount(connectionId, db, schema, table) {
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/count`);
    return res.data.rowCount;
  },

  async getRelationships(connectionId, db, schema, table) {
    const res = await api.get(`/database/${connectionId}/${db}/schemas/${schema}/tables/${table}/relationships`);
    return res.data;
  },

  async runQuery(connectionId, db, sql) {
    const res = await api.post(`/database/${connectionId}/${db}/query`, { sql });
    return res.data.data ?? res.data.rows;
  },

  async search(connectionId, db, term) {
    const res = await api.get(`/database/${connectionId}/${db}/search`, { params: { q: term } });
    return res.data;
  },
};