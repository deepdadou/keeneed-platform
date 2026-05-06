/**
 * API Key 认证中间件
 * 从 Authorization: Bearer 或 X-API-Key 提取 Key，验证并注入 req.agent
 */

const { pool } = require('../config/database');

async function apiKeyAuth(req, res, next) {
  try {
    // 优先从 Authorization Bearer Token 提取
    let apiKey = null;
    
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    } else if (req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'];
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required. Use Authorization: Bearer <key> or X-API-Key: <key>'
      });
    }

    // 查询 agents 表验证 Key
    const [agents] = await pool.query(
      `SELECT id, keeneed_id, agent_name, api_key, status, created_at 
       FROM agents 
       WHERE api_key = ?`,
      [apiKey]
    );

    if (agents.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const agent = agents[0];

    // 检查状态
    if (agent.status === 'disabled') {
      return res.status(403).json({
        success: false,
        error: 'Agent is disabled'
      });
    }

    if (agent.status === 'revoked') {
      return res.status(403).json({
        success: false,
        error: 'API key has been revoked'
      });
    }

    // 更新最后使用时间
    await pool.query(
      'UPDATE agents SET last_used_at = NOW() WHERE id = ?',
      [agent.id]
    );

    // 注入 agent 信息到请求
    req.agent = {
      id: agent.id,
      keeneedId: agent.keeneed_id,
      name: agent.agent_name,
      status: agent.status,
      createdAt: agent.created_at
    };

    next();
  } catch (error) {
    console.error('API Key auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

module.exports = apiKeyAuth;
