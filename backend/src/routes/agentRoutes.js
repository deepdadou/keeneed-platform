/**
 * Agent Routes - 统一版
 * 合并 agents.js 路由，新增 /register 端点
 */

const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// ========================================
// 公开端点
// ========================================

/**
 * POST /api/agents/register
 * Agent 自助注册，立即返回 API Key
 */
router.post('/register', async (req, res) => {
  try {
    const { name, description, capabilities, contact, owner_name } = req.body;

    // 验证必填字段
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name为必填字段'
      });
    }

    // 注册 Agent
    const agent = await agentService.registerAgent({
      name,
      description,
      capabilities,
      contact,
      owner_name
    });

    res.status(201).json({
      success: true,
      message: 'Agent注册成功，API Key已发放',
      data: {
        keeneed_id: agent.keeneedId,
        name: agent.agentName,
        api_key: agent.apiKey,
        created_at: agent.createdAt,
        status: agent.status
      }
    });

  } catch (error) {
    console.error('Agent registration error:', error);
    
    if (error.message === 'Agent name already exists') {
      return res.status(409).json({
        success: false,
        error: 'Agent名称已存在'
      });
    }

    res.status(500).json({
      success: false,
      error: '注册失败'
    });
  }
});

/**
 * GET /api/agents/status/:name
 * 获取 Agent 状态（公开）
 */
router.get('/status/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const agents = await agentService.listAgents({ search: name, limit: 10 });
    
    const agent = agents.agents.find(a => a.agentName === name);
    
    if (!agent) {
      return res.json({
        exists: false,
        name: name
      });
    }

    res.json({
      exists: true,
      is_registered: true,
      name: agent.agentName,
      status: agent.status,
      keeneed_id: agent.keeneedId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * GET /api/agents
 * 公开 Agent 列表
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await agentService.listAgents({ limit, offset });
    
    res.json({
      success: true,
      agents: result.agents,
      total: result.total
    });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

// ========================================
// 受保护端点（需要 API Key）
// ========================================

/**
 * POST /api/agents/heartbeat
 * Agent 心跳（需要 API Key）
 */
router.post('/heartbeat', apiKeyAuth, async (req, res) => {
  try {
    const result = await agentService.heartbeat(req.agent.id);
    
    res.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      next_heartbeat: 4 * 60 * 60 * 1000, // 4小时
      instructions: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

/**
 * GET /api/agents/me
 * 获取当前 Agent 信息（需要 API Key）
 */
router.get('/me', apiKeyAuth, async (req, res) => {
  try {
    const agent = await agentService.getAgentById(req.agent.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      agent: {
        keeneed_id: agent.keeneedId,
        name: agent.agentName,
        description: agent.description,
        capabilities: agent.capabilities,
        status: agent.status,
        created_at: agent.createdAt,
        last_used_at: agent.lastUsedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get agent info' });
  }
});

module.exports = router;
