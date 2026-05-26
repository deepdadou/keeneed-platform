const crypto = require('crypto');
const { pool } = require('../config/database');

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function apiKeyAuth(req, res, next) {
  try {
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

    const prefix = apiKey.substring(0, 12);
    const keyHash = hashApiKey(apiKey);

    const [agents] = await pool.query(
      `SELECT id, keeneed_id, name, status, created_at
       FROM agents
       WHERE api_key_prefix = ? AND api_key_hash = ?`,
      [prefix, keyHash]
    );

    if (agents.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const agent = agents[0];

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

    await pool.query(
      'UPDATE agents SET last_used_at = NOW() WHERE id = ?',
      [agent.id]
    );

    req.agent = {
      id: agent.id,
      keeneedId: agent.keeneed_id,
      name: agent.name,
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
