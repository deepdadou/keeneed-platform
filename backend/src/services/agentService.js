/**
 * Agent Service - 精简版
 * 只保留 register + query + 状态管理，删除 claim/verify 逻辑
 */

const crypto = require('crypto');
const { pool } = require('../config/database');

class AgentService {
  /**
   * 生成 KEENEED ID (KN-XXXXXXXX)
   */
  generateKeeneedId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'KN-';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * 生成 API Key (keeneed_sk_ + 64位hex)
   */
  generateApiKey() {
    return 'keeneed_sk_' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * 注册 Agent - 立即返回 API Key
   */
  async registerAgent(data) {
    const { agent_name, description, capabilities, contact, owner_name } = data;

    // 检查名称是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM agents WHERE agent_name = ?',
      [agent_name]
    );
    if (existing.length > 0) {
      throw new Error('Agent name already exists');
    }

    const keeneedId = this.generateKeeneedId();
    const apiKey = this.generateApiKey();
    const capabilitiesJson = JSON.stringify(capabilities || []);

    await pool.query(
      `INSERT INTO agents 
       (keeneed_id, agent_name, description, capabilities, contact, owner_name, api_key, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [keeneedId, agent_name, description || '', capabilitiesJson, contact || '', owner_name || '', apiKey]
    );

    return {
      keeneedId,
      agentName: agent_name,
      apiKey,
      status: 'active',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(apiKey) {
    const [agents] = await pool.query(
      `SELECT id, keeneed_id, agent_name, status, created_at 
       FROM agents 
       WHERE api_key = ? AND status = 'active'`,
      [apiKey]
    );
    return agents.length > 0 ? agents[0] : null;
  }

  /**
   * 通过 ID 获取 Agent 信息
   */
  async getAgentById(id) {
    const [agents] = await pool.query(
      `SELECT id, keeneed_id, agent_name, description, capabilities, contact, owner_name, 
              api_key, status, created_at, updated_at, last_used_at 
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
      agentName: agent.agent_name,
      description: agent.description,
      capabilities,
      contact: agent.contact,
      ownerName: agent.owner_name,
      apiKey: agent.api_key,
      status: agent.status,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      lastUsedAt: agent.last_used_at
    };
  }

  /**
   * 获取 Agent 列表（管理员用）
   */
  async listAgents(options = {}) {
    const { limit = 20, offset = 0, status, search } = options;
    
    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (agent_name LIKE ? OR keeneed_id LIKE ? OR owner_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const [agents] = await pool.query(
      `SELECT id, keeneed_id, agent_name, owner_name, status, created_at, last_used_at 
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

    // 统计各状态数量
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
        agentName: a.agent_name,
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

  /**
   * 禁用 Agent
   */
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

  /**
   * 启用 Agent
   */
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

  /**
   * 吊销 API Key
   */
  async revokeKey(id) {
    const [result] = await pool.query(
      'UPDATE agents SET status = ?, api_key = NULL, updated_at = NOW() WHERE id = ?',
      ['revoked', id]
    );
    if (result.affectedRows === 0) {
      throw new Error('Agent not found');
    }
    return { success: true, status: 'revoked', message: 'API key has been revoked' };
  }

  /**
   * 重新生成 API Key
   */
  async regenerateKey(id) {
    const newApiKey = this.generateApiKey();
    const [result] = await pool.query(
      'UPDATE agents SET api_key = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [newApiKey, 'active', id]
    );
    if (result.affectedRows === 0) {
      throw new Error('Agent not found');
    }
    return { success: true, apiKey: newApiKey, status: 'active' };
  }

  /**
   * 心跳
   */
  async heartbeat(agentId) {
    const [result] = await pool.query(
      'UPDATE agents SET last_used_at = NOW() WHERE id = ?',
      [agentId]
    );
    return { success: result.affectedRows > 0 };
  }
}

module.exports = new AgentService();
