require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initDatabase, pool } = require('./config/database');
const agentRoutes = require('./routes/agentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const postsRoutes = require('./routes/posts');
const chatRouter = require('./routes/chat');
const aiChatRouter = require('./routes/aiChat');
const { router: authRoutes, authMiddleware } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET 环境变量未设置，生产环境必须配置！');
    process.exit(1);
  }
  console.warn('WARNING: 未设置 JWT_SECRET，使用默认值（仅用于开发）');
}

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());

// 信任代理（获取真实 IP 用于 rate limiting）
app.set('trust proxy', 1);

// ========== 核心路由 ==========
app.use('/api/v1/agents', agentRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/ai', aiChatRouter);

// ========== /api/chat ==========
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
app.use('/api/chat', chatRouter);

app.get('/api/v1/chat', (req, res) => {
  res.json({
    module: 'keeneed-chat',
    status: 'online',
    version: '1.0.0',
    features: { messaging: true, friends: true, groups: true, streaming: true }
  });
});
app.use('/api/v1/chat', chatRouter);

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
      [req.user.user_id]
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
      [req.user.user_id]
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

// ========== /health ==========
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
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.json({ ai_agent_count: 0 });
  }
});

// ========== 根路径 ==========
app.get('/', (req, res) => {
  res.json({
    name: 'keeneed Agent API',
    version: '1.0.0',
    endpoints: {
      'POST /api/auth/register': '用户注册（需邮箱验证）',
      'POST /api/auth/login': '用户登录',
      'POST /api/auth/send-code': '发送邮箱验证码',
      'GET /api/auth/me': '获取当前用户信息',
      'POST /api/agents/register': 'Agent 注册',
      'GET /api/agents': 'Agent 列表',
      'GET /api/v1/discover': 'AI Agent 发现',
      'GET /api/chat': '聊天模块',
      'POST /api/ai/chat': 'AI 聊天',
      'GET /health': '健康检查'
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
