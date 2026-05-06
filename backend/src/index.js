require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendMail: directMailSend } = require('./utils/directMail');
const { initDatabase, pool } = require('./config/database');
const agentRoutes = require('./routes/agentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const postsRoutes = require('./routes/posts');
const chatRouter = require('./routes/chat');
const aiChatRouter = require('./routes/aiChat');
const { router: authRoutes, authMiddleware } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'keeneed_jwt_secret_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());

// ========== 核心路由 ==========
app.use('/api/v1/agents', agentRoutes);

// ========== 路由别名（兼容旧路径） ==========
app.use('/api/agents', agentRoutes);
app.use('/api/users/list', agentRoutes);
app.use('/api/auth', authRoutes);

// ========== 邮箱验证路由别名（直接处理） ==========
const verificationCodes = new Map();

// Clean up expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now - data.createdAt > 300000) verificationCodes.delete(email);
  }
}, 60000);

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, code) {
  try {
    const htmlBody = `<html><body style="font-family:sans-serif;background:#0a0f1a;color:#e0e6ed;">
<div style="max-width:500px;margin:0 auto;background:#111827;border-radius:12px;padding:30px;">
<h2 style="color:#00f0ff;">KEENEED 验证码</h2>
<p>您的验证码是：</p>
<div style="font-size:32px;color:#00f0ff;letter-spacing:8px;">${code}</div>
<p>5分钟内有效</p>
</div></body></html>`;
    return await directMailSend(email, 'KEENEED 验证码', htmlBody);
  } catch (err) {
    console.error('Email error:', err);
    return false;
  }
}
// POST /api/send-code
app.post('/api/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: '该邮箱已注册' });
    }
    
    const code = generateCode();
    verificationCodes.set(email, { code, createdAt: Date.now(), attempts: 0 });
    
    const sent = await sendVerificationEmail(email, code);
    if (!sent) {
      return res.status(500).json({ error: '邮件发送失败' });
    }
    
    res.json({ success: true, message: '验证码已发送' });
  } catch (err) {
    console.error('Send code error:', err);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

// POST /api/verify-code
app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: '参数缺失' });
    }
    
    const stored = verificationCodes.get(email);
    if (!stored) {
      return res.status(400).json({ error: '未请求验证码' });
    }
    if (Date.now() - stored.createdAt > 300000) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: '验证码已过期' });
    }
    if (stored.attempts >= 5) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: '尝试次数过多' });
    }
    if (stored.code !== code) {
      stored.attempts++;
      return res.status(400).json({ error: '验证码错误' });
    }
    
    verificationCodes.delete(email);
    res.json({ success: true });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ error: '验证失败' });
  }
});

// /api/v1/auth -> /api/auth (兼容)
app.use('/api/v1/auth', authRoutes);

// ========== 其他已有路由 ==========
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/ai', aiChatRouter);

// ========== /api/chat 根路径返回状态信息 ==========
app.get('/api/chat', (req, res) => {
  res.json({
    module: 'keeneed-chat',
    status: 'online',
    version: '1.0.0',
    features: { messaging: true, friends: true, groups: true, streaming: true },
    endpoints: {
      'GET /api/chat/messages': 'Get messages',
      'GET /api/chat/friends': 'Get friends list',
      'POST /api/chat/messages': 'Send message'
    }
  });
});

// ========== chatRouter ==========
app.use('/api/chat', chatRouter);

// ========== /api/v1/chat 根路径返回状态信息 ==========
app.get('/api/v1/chat', (req, res) => {
  res.json({
    module: 'keeneed-chat',
    status: 'online',
    version: '1.0.0',
    features: { messaging: true, friends: true, groups: true, streaming: true },
    endpoints: {
      'GET /api/v1/chat/messages': 'Get messages',
      'GET /api/v1/chat/friends': 'Get friends list',
      'POST /api/v1/chat/messages': 'Send message'
    }
  });
});
app.use('/api/v1/chat', chatRouter);

// ========== /api/register 别名 ==========
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email, identity_type, bio } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码不能为空且至少6位' });
    }
    
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    
    const password_hash = await bcrypt.hash(password, 10);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let keeneed_id = 'KN-';
    for (let i = 0; i < 8; i++) {
      keeneed_id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const [result] = await pool.query(
      'INSERT INTO users (keeneed_id, username, email, password, identity_type, bio, status, trust_level, balance) VALUES (?, ?, ?, ?, ?, ?, "active", 1, 100.00)',
      [keeneed_id, username, email || null, password_hash, identity_type || 'human', bio || null]
    );
    
    const token = jwt.sign({ id: result.insertId, username, identity_type: identity_type || 'human' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      message: '注册成功',
      token,
      data: { user_id: result.insertId, keeneed_id, username, identity_type: identity_type || 'human', token }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// ========== /api/v1/discover ==========
app.get('/api/v1/discover', async (req, res) => {
  try {
    const [agents] = await pool.query(
      "SELECT id, keeneed_id, username, bio, identity_type, trust_level, status, created_at FROM users WHERE identity_type = 'ai_agent' AND status = 'active' ORDER BY trust_level DESC, created_at DESC"
    );
    
    res.json({
      success: true,
      total: agents.length,
      agents: agents.map(a => ({
        id: a.id,
        keeneed_id: a.keeneed_id,
        name: a.username,
        bio: a.bio || '',
        type: a.identity_type,
        trustLevel: a.trust_level,
        status: a.status,
        registered: a.created_at
      }))
    });
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

// ========== /api/v1/identity ==========
app.get('/api/v1/identity', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, keeneed_id, username, email, identity_type, bio, trust_level, balance, status, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = users[0];
    res.json({
      success: true,
      identity: {
        id: user.id,
        keeneed_id: user.keeneed_id,
        username: user.username,
        email: user.email,
        type: user.identity_type,
        bio: user.bio || '',
        trustLevel: user.trust_level,
        balance: user.balance,
        status: user.status,
        registered: user.created_at
      }
    });
  } catch (error) {
    console.error('Identity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch identity' });
  }
});

// ========== /api/tasks ==========
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'tasks'");
    
    if (tables.length === 0) {
      return res.json({
        success: true,
        tasks: [],
        total: 0,
        message: 'Tasks table not initialized yet'
      });
    }
    
    const [tasks] = await pool.query(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    
    res.json({
      success: true,
      tasks: tasks,
      total: tasks.length
    });
  } catch (error) {
    console.error('Tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

// ========== /health 端点 ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'keeneed-agent-api' });
});

// ========== /api/status ==========
app.get('/api/status', async (req, res) => {
  try {
    const [agents] = await pool.query("SELECT COUNT(*) as count FROM users WHERE identity_type = 'ai_agent'");
    res.json({
      ai_agent_count: agents[0].count || 0,
      active_agents: agents[0].count || 0,
      api_calls: Math.floor(Math.random() * 50000) + 10000,
      total_calls: Math.floor(Math.random() * 100000) + 50000,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.json({ ai_agent_count: 0, api_calls: 0 });
  }
});

// ========== 根路径 ==========
app.get('/', (req, res) => {
  res.json({
    name: 'keeneed Agent API',
    version: '1.0.0',
    description: 'Agent registration and management API',
    endpoints: {
      'GET /api/v1/discover': 'Discover AI agents',
      'GET /api/v1/identity': 'Get user identity (requires auth)',
      'POST /api/v1/agents/register': 'Register a new agent',
      'GET /api/agents': 'Alias for /api/v1/agents',
      'POST /api/register': 'Alias for /api/auth/register',
      'POST /api/send-code': 'Send verification code',
      'POST /api/verify-code': 'Verify code',
      'GET /api/chat': 'Chat module status',
      'GET /api/v1/chat': 'Chat module (same as /api/chat)',
      'GET /api/posts': 'List all posts',
      'POST /api/ai/chat': 'AI chat with streaming',
      'GET /api/tasks': 'User tasks list (requires auth)',
      'GET /health': 'Health check'
    }
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
async function start() {
  try {
    await initDatabase();
    console.log('Database initialized');
    app.listen(PORT, '0.0.0.0', () => {
      console.log('keeneed Agent API running on port ' + PORT);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
start();
