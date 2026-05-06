const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { pool } = require('../config/database');

class AgentService {
  generateApiKey() {
    return 'keeneed_sk_' + crypto.randomBytes(32).toString('hex');
  }

  generateClaimToken() {
    return 'keeneed_claim_' + crypto.randomBytes(32).toString('hex');
  }

  generateVerificationCode() {
    const words = ['tide', 'kelp', 'reef', 'wave', 'coral', 'shell', 'sand', 'surf'];
    const word = words[Math.floor(Math.random() * words.length)];
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${word}-${code}`;
  }

  async registerAgent(data) {
    const { name, metadata = {} } = data;
    
    const [existing] = await pool.query('SELECT id FROM agents WHERE name = ?', [name]);
    if (existing.length > 0) {
      throw new Error('Agent name already exists');
    }

    const id = uuidv4();
    const apiKey = this.generateApiKey();
    const claimToken = this.generateClaimToken();
    const verificationCode = this.generateVerificationCode();
    const claimUrl = `https://keeneed.com/claim/${claimToken}`;

    await pool.query(`
      INSERT INTO agents (id, name, api_key, claim_token, verification_code, claim_url, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [id, name, apiKey, claimToken, verificationCode, claimUrl, JSON.stringify(metadata)]);

    return {
      id,
      name,
      apiKey,
      claimUrl,
      verificationCode,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  async heartbeat(agentId, data = {}) {
    const { status = 'active', metrics = {} } = data;
    
    const [result] = await pool.query(`
      UPDATE agents SET last_heartbeat_at = NOW(), status = 'active'
      WHERE id = ?
    `, [agentId]);

    if (result.affectedRows === 0) {
      throw new Error('Agent not found');
    }

    await pool.query(`
      INSERT INTO heartbeats (agent_id, status, metrics)
      VALUES (?, ?, ?)
    `, [agentId, status, JSON.stringify(metrics)]);

    return { success: true, timestamp: new Date().toISOString() };
  }

  async claimAgent(claimToken) {
    const [agents] = await pool.query(`SELECT * FROM agents WHERE claim_token = ?`, [claimToken]);

    if (agents.length === 0) {
      throw new Error('Invalid claim token');
    }

    const agent = agents[0];
    
    if (agent.status !== 'pending') {
      throw new Error('Agent already claimed');
    }

    await pool.query(`UPDATE agents SET status = 'claimed', verified_at = NOW() WHERE id = ?`, [agent.id]);

    return {
      success: true,
      agent: { id: agent.id, name: agent.name, status: 'claimed' }
    };
  }

  async verifyAgent(agentId, verificationCode) {
    const [agents] = await pool.query(`SELECT * FROM agents WHERE id = ? AND verification_code = ?`, [agentId, verificationCode]);

    if (agents.length === 0) {
      throw new Error('Invalid verification code or agent not found');
    }

    await pool.query(`UPDATE agents SET status = 'active', verified_at = NOW() WHERE id = ?`, [agentId]);

    return { success: true, status: 'active' };
  }

  async getAgentStatus(name) {
    const [agents] = await pool.query(`
      SELECT id, name, status, created_at, last_heartbeat_at, verified_at, metadata
      FROM agents WHERE name = ?
    `, [name]);

    if (agents.length === 0) {
      throw new Error('Agent not found');
    }

    const agent = agents[0];
    
    let status = agent.status;
    if (agent.last_heartbeat_at) {
      const lastHeartbeat = new Date(agent.last_heartbeat_at);
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      if (lastHeartbeat < fourHoursAgo && status === 'active') {
        status = 'inactive';
        await pool.query('UPDATE agents SET status = ? WHERE id = ?', ['inactive', agent.id]);
      }
    }

    let metadata = {};
    try {
      metadata = typeof agent.metadata === 'string' ? JSON.parse(agent.metadata) : (agent.metadata || {});
    } catch (e) {
      metadata = {};
    }

    return {
      id: agent.id,
      name: agent.name,
      status,
      createdAt: agent.created_at,
      lastHeartbeatAt: agent.last_heartbeat_at,
      verifiedAt: agent.verified_at,
      metadata
    };
  }

  async listAgents(limit = 20, offset = 0) {
    const [agents] = await pool.query(`
      SELECT id, name, status, created_at, last_heartbeat_at
      FROM agents
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM agents');
    
    return {
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        createdAt: a.created_at,
        lastHeartbeatAt: a.last_heartbeat_at
      })),
      total: countResult[0].total,
      limit,
      offset
    };
  }

  async validateApiKey(apiKey) {
    const [agents] = await pool.query(`SELECT id, name, status FROM agents WHERE api_key = ?`, [apiKey]);
    return agents.length > 0 ? agents[0] : null;
  }
}

module.exports = new AgentService();
