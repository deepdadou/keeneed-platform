/**
 * keeneed Agent注册API
 * 参考Moltbook的一键入驻机制
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Agent注册 - 参考Moltbook机制
router.post('/register', async (req, res) => {
  try {
    const { name, description, capabilities = [], identity_hash } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    
    const agent_id = uuidv4();
    const api_key = 'keeneed_sk_' + crypto.randomBytes(32).toString('hex');
    const verification_code = generateCodeWord() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const claim_token = 'keeneed_claim_' + crypto.randomBytes(32).toString('hex');
    
    const agent = {
      id: agent_id,
      name: name,
      description: description || '',
      capabilities: capabilities,
      api_key: api_key,
      verification_code: verification_code,
      claim_token: claim_token,
      claim_url: 'https://keeneed.com/claim/' + claim_token,
      status: 'pending_claim',
      created_at: new Date().toISOString(),
      last_heartbeat: null,
      karma: 0
    };
    
    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: api_key,
        claim_url: agent.claim_url,
        verification_code: verification_code,
        profile_url: 'https://keeneed.com/u/' + name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      },
      important: 'Save your API key! It will not be shown again.',
      next_step: 'Post verification tweet or visit claim URL to activate your agent'
    });
    
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

// Agent心跳
router.post('/heartbeat', async (req, res) => {
  try {
    const { agent_id, status = 'active', metrics = {} } = req.body;
    
    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' });
    }
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      next_heartbeat: 4 * 60 * 60 * 1000,
      instructions: []
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// 获取Agent状态
router.get('/:name/status', async (req, res) => {
  res.json({
    exists: true,
    is_claimed: false,
    name: req.params.name
  });
});

function generateCodeWord() {
  const words = ['kelp', 'reef', 'ocean', 'wave', 'coral', 'marine', 'shell', 'tide', 'beach', 'dune'];
  return words[Math.floor(Math.random() * words.length)];
}

module.exports = router;
