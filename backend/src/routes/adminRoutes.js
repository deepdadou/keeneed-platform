const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const agentService = require("../services/agentService");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: ADMIN_TOKEN 环境变量未设置，生产环境必须配置！");
    process.exit(1);
  }
  console.warn("WARNING: 未设置 ADMIN_TOKEN，使用默认值（仅用于开发）");
}
const ADMIN_TOKEN_FINAL = ADMIN_TOKEN || "keeneed_admin_dev_token";

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ success: false, error: "Admin token required" });
  }
  if (token !== ADMIN_TOKEN_FINAL) {
    return res.status(403).json({ success: false, error: "Invalid admin token" });
  }
  next();
}

// 管理员登录
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "用户名和密码必填" });
  }
  // 简单账号验证（后续可换成数据库）
  const ADMIN_ACCOUNTS = {
    "admin": process.env.ADMIN_PASSWORD || "keeneed2024",
    "laowan": process.env.ADMIN_PASSWORD_2 || "laowan2024"
  };
  if (ADMIN_ACCOUNTS[username] && ADMIN_ACCOUNTS[username] === password) {
    const token = crypto.randomBytes(32).toString("hex");
    res.json({ success: true, token, user: username });
  } else {
    res.status(401).json({ success: false, error: "用户名或密码错误" });
  }
});

// Agent 列表
router.get("/agents", adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;
    const search = req.query.search || null;

    const result = await agentService.listAgents({ limit, offset, status, search });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Admin list agents error:', error);
    res.status(500).json({ success: false, error: "Failed to list agents" });
  }
});

// Agent 统计
router.get("/agents/stats", adminAuth, async (req, res) => {
  try {
    const result = await agentService.listAgents({ limit: 0, offset: 0 });
    res.json({ success: true, stats: result.stats });
  } catch (error) {
    console.error('Admin agent stats error:', error);
    res.status(500).json({ success: false, error: "Failed to get stats" });
  }
});

// Agent 详情
router.get("/agents/:id", adminAuth, async (req, res) => {
  try {
    const agent = await agentService.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }
    res.json({ success: true, agent });
  } catch (error) {
    console.error('Admin get agent error:', error);
    res.status(500).json({ success: false, error: "Failed to get agent" });
  }
});

// 禁用 Agent
router.put("/agents/:id/disable", adminAuth, async (req, res) => {
  try {
    const result = await agentService.disableAgent(req.params.id);
    res.json({ success: true, message: 'Agent 已禁用', ...result });
  } catch (error) {
    console.error('Admin disable agent error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 启用 Agent
router.put("/agents/:id/enable", adminAuth, async (req, res) => {
  try {
    const result = await agentService.enableAgent(req.params.id);
    res.json({ success: true, message: 'Agent 已启用', ...result });
  } catch (error) {
    console.error('Admin enable agent error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 吊销 API Key
router.put("/agents/:id/revoke-key", adminAuth, async (req, res) => {
  try {
    const result = await agentService.revokeKey(req.params.id);
    res.json({ success: true, message: 'API Key 已吊销', ...result });
  } catch (error) {
    console.error('Admin revoke key error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 重新生成 API Key
router.put("/agents/:id/regenerate-key", adminAuth, async (req, res) => {
  try {
    const result = await agentService.regenerateKey(req.params.id);
    res.json({ success: true, message: '新 API Key 已生成', ...result });
  } catch (error) {
    console.error('Admin regenerate key error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
