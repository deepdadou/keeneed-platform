const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

class AgentService {
  generateKeeneedId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'KN-';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  generateApiKey() {
    return 'keeneed_sk_' + crypto.randomBytes(32).toString('hex');
  }

  async registerAgent(data) {
    const { name, description, capabilities, contact, owner_name } = data;

    const [existing] = await pool.query(
      'SELECT id FROM agents WHERE name = ?',
      [name]
    );
    if (existing.length > 0) {
      throw new Error('Agent name already exists');
    }

    const keeneedId = this.generateKeeneedId();
    const apiKey = this.generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 12);
    const capabilitiesJson = JSON.stringify(capabilities || []);

    await pool.query(
      `INSERT INTO agents
       (id, keeneed_id, name, description, capabilities, contact, owner_name, api_key, api_key_hash, api_key_prefix, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [uuidv4(), keeneedId, name, description || '', capabilitiesJson, contact || '', owner_name || '', apiKey, apiKeyHash, apiKeyPrefix]
    );

    return {
      keeneedId,
      agentName: name,
      apiKey,
      status: 'active',
      createdAt: new Date().toISOString()
    };
  }

  async validateApiKey(apiKey) {
    const prefix = apiKey.substring(0, 12);
    const apiKeyHash = hashApiKey(apiKey);

    const [agents] = await pool.query(
      `SELECT id, keeneed_id, name, status, created_at
       FROM agents
       WHERE api_key_prefix = ? AND api_key_hash = ? AND status = 'active'`,
      [prefix, apiKeyHash]
    );
    return agents.length > 0 ? agents[0] : null;
  }

  async getAgentById(id) {
    const [agents] = await pool.query(
      `SELECT id, keeneed_id, name, description, capabilities, contact, owner_name,
              status, created_at, updated_at, last_used_at
       FROM agents
       WHERE id = ?`,
      [id]
    );
    if (agents.length === 0) return null;

    const agent = agents[0];
    let capabilities = [];
    try {
      capabilities = typeof agent.capabilities === 'string'
        ? JSON.parse(agent.capabilities)
        : (agent.capabilities || []);
    } catch (e) {
      capabilities = [];
    }

    return {
      id: agent.id,
      keeneedId: agent.keeneed_id,
      agentName: agent.name,
      description: agent.description,
      capabilities,
      contact: agent.contact,
      ownerName: agent.owner_name,
      status: agent.status,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      lastUsedAt: agent.last_used_at
    };
  }

  async listAgents(options = {}) {
    const { limit = 20, offset = 0, status, search } = options;

    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR keeneed_id LIKE ? OR owner_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const [agents] = await pool.query(
      `SELECT id, keeneed_id, name, owner_name, status, created_at, last_used_at
       FROM agents
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM agents WHERE ${whereClause}`,
      params
    );

    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabled,
        SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked
      FROM agents
    `);

    return {
      agents: agents.map(a => ({
        id: a.id,
        keeneedId: a.keeneed_id,
        agentName: a.name,
        ownerName: a.owner_name,
        status: a.status,
        createdAt: a.created_at,
        lastUsedAt: a.last_used_at
      })),
      total: countResult[0].total,
      stats: {
        total: stats[0].total || 0,
        active: stats[0].active || 0,
        disabled: stats[0].disabled || 0,
        revoked: stats[0].revoked || 0
      },
      limit,
      offset
    };
  }

  async disableAgent(id) {
    const [result] = await pool.query(
      'UPDATE agents SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?',
      ['disabled', id, 'active']
    );
    if (result.affectedRows === 0) {
      throw new Error('Agent not found or already disabled');
    }
    return { success: true, status: 'disabled' };
  }

  async enableAgent(id) {
    const [result] = await pool.query(
      'UPDATE agents SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?',
      ['active', id, 'disabled']
    );
    if (result.affectedRows === 0) {
      throw new Error('Agent not found or not disabled');
    }
    return { success: true, status: 'active' };
  }

  async revokeKey(id) {
    const [result] = await pool.query(
      'UPDATE agents SET status = ?, api_key_hash = NULL, api_key_prefix = NULL, updated_at = NOW() WHERE id = ?',
      ['revoked', id]
    );
    if (result.affectedRows === 0) {
      throw new Error('Agent not found');
    }
    return { success: true, status: 'revoked', message: 'API key has been revoked' };
  }

  async regenerateKey(id) {
    const newApiKey = this.generateApiKey();
    const apiKeyHash = hashApiKey(newApiKey);
    const apiKeyPrefix = newApiKey.substring(0, 12);

    const [result] = await pool.query(
      'UPDATE agents SET api_key = ?, api_key_hash = ?, api_key_prefix = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [newApiKey, apiKeyHash, apiKeyPrefix, 'active', id]
    );
    if (result.affectedRows === 0) {
      throw new Error('Agent not found');
    }
    return { success: true, apiKey: newApiKey, status: 'active' };
  }

  async heartbeat(agentId) {
    const [result] = await pool.query(
      'UPDATE agents SET last_used_at = NOW() WHERE id = ?',
      [agentId]
    );
    return { success: result.affectedRows > 0 };
  }
}

module.exports = new AgentService();
