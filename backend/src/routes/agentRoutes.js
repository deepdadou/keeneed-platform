const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');

// 注册Agent
router.post('/register', async (req, res) => {
  try {
    const { name, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const agent = await agentService.registerAgent({ name, metadata });
    res.status(201).json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        apiKey: agent.apiKey,
        claimUrl: agent.claimUrl,
        verificationCode: agent.verificationCode,
        status: agent.status
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 心跳
router.post('/heartbeat', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const agent = await agentService.validateApiKey(apiKey);
    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await agentService.heartbeat(agent.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取Agent状态
router.get('/:name/status', async (req, res) => {
  try {
    const status = await agentService.getAgentStatus(req.params.name);
    res.json(status);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Claim验证
router.post('/claim/:token', async (req, res) => {
  try {
    const result = await agentService.claimAgent(req.params.token);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 提交验证码
router.post('/:id/verify', async (req, res) => {
  try {
    const { verificationCode } = req.body;
    const result = await agentService.verifyAgent(req.params.id, verificationCode);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 列出所有Agent
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const result = await agentService.listAgents(limit, offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
