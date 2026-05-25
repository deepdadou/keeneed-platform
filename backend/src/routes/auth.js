const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "keeneed_jwt_secret_2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// 生成keeneed_id
function generateKeeneedId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "KN-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// =====================验证码存储（内存Map）=====================
const verificationCodes = new Map(); // { email: { code, expiresAt } }

// 生成6位验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 清理过期验证码
function cleanupExpiredCodes() {
  const now = new Date();
  for (const [email, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(email);
    }
  }
}
// 每5分钟清理一次
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

// =====================发送验证码接口=====================
router.post("/send-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "邮箱不能为空" });
    }

    // 简单邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "邮箱格式不正确" });
    }

    // 生成6位验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期

    // 存储到内存Map
    verificationCodes.set(email, {
      code: code,
      expiresAt: expiresAt,
      attempts: 0
    });

    // 同时存储到数据库（用于持久化验证）
    try {
      // 先删除旧验证码
      await pool.query("DELETE FROM email_verify_codes WHERE email = ?", [email]);
      
      // 插入新验证码
      await pool.query(
        "INSERT INTO email_verify_codes (email, code, expires_at, used) VALUES (?, ?, ?, 0)",
        [email, code, expiresAt]
      );
    } catch (dbError) {
      console.log("数据库存储验证码失败，使用内存存储:", dbError.message);
    }

    // TODO: 实际发送邮件（需要SMTP配置）
    // 暂时返回验证码用于测试
    console.log(`验证码已生成: ${email} -> ${code}`);
    
    // 在开发环境返回验证码，生产环境应该隐藏
    const isDev = process.env.NODE_ENV !== 'production';
    
    res.json({ 
      success: true, 
      message: "验证码已发送",
      // 开发环境返回验证码方便测试
      ...(isDev && { code: code }),
      expires_in: 300 // 5分钟
    });
  } catch (err) {
    console.error("发送验证码错误:", err);
    res.status(500).json({ error: "发送验证码失败" });
  }
});

// =====================验证验证码接口=====================
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "邮箱和验证码不能为空" });
    }

    // 先检查内存Map
    const memoryData = verificationCodes.get(email);
    if (memoryData && memoryData.code === code && memoryData.expiresAt > new Date()) {
      // 标记为已使用
      memoryData.used = true;
      
      // 更新数据库
      try {
        await pool.query(
          "UPDATE email_verify_codes SET used = 1 WHERE email = ? AND code = ?",
          [email, code]
        );
      } catch (dbError) {
        console.log("数据库更新验证码状态失败:", dbError.message);
      }
      
      return res.json({ success: true, message: "验证成功" });
    }

    // 检查数据库
    try {
      const [records] = await pool.query(
        "SELECT * FROM email_verify_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
        [email, code]
      );

      if (records.length > 0) {
        // 标记为已使用
        await pool.query("UPDATE email_verify_codes SET used = 1 WHERE id = ?", [records[0].id]);
        return res.json({ success: true, message: "验证成功" });
      }
    } catch (dbError) {
      console.log("数据库查询验证码失败:", dbError.message);
    }

    res.status(400).json({ error: "验证码错误或已过期" });
  } catch (err) {
    console.error("验证验证码错误:", err);
    res.status(500).json({ error: "验证失败" });
  }
});

// =====================注册=====================
router.post("/register", async (req, res) => {
  try {
    const { username, password, email, identity_type, bio } = req.body;

    // 验证必填字段
    if (!username) {
      return res.status(400).json({ error: "用户名不能为空" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "密码长度至少6位" });
    }

    // 检查用户名是否已存在
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "用户名已存在" });
    }

    // 如果提供了邮箱，检查邮箱唯一性
    if (email) {
      const [existingEmail] = await pool.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({ error: "邮箱已被使用" });
      }
    }

    // 密码哈希
    const password_hash = await bcrypt.hash(password, 10);

    // 生成keeneed_id
    let keeneed_id;
    let attempts = 0;
    do {
      keeneed_id = generateKeeneedId();
      const [dup] = await pool.query(
        "SELECT id FROM users WHERE keeneed_id = ?",
        [keeneed_id]
      );
      if (dup.length === 0) break;
      attempts++;
    } while (attempts < 10);

    // 身份类型
    const userType = identity_type || "human";

    // 插入用户
    const [result] = await pool.query(
      `INSERT INTO users (keeneed_id, username, email, password_hash, identity_type, bio, status, trust_level, balance)
       VALUES (?, ?, ?, ?, ?, ?, "active", 1, 100.00)`,
      [keeneed_id, username, email || null, password_hash, userType, bio || null]
    );

    // 生成token
    const token = jwt.sign(
      { user_id: result.insertId, username, identity_type: userType },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: "注册成功",
      data: {
        user_id: result.insertId,
        keeneed_id: keeneed_id,
        username: username,
        identity_type: userType,
        token,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "注册失败" });
  }
});

// =====================登录=====================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }

    // 查询用户
    const [users] = await pool.query(
      "SELECT id, keeneed_id, username, email, password_hash, identity_type, bio, status FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const user = users[0];

    // 检查用户状态
    if (user.status === "banned") {
      return res.status(403).json({ error: "用户已被禁用" });
    }

    // 验证密码
    if (!user.password_hash) {
      return res.status(401).json({ error: "用户未设置密码，请使用其他方式登录" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    // 生成token
    const token = jwt.sign(
      { user_id: user.id, username: user.username, identity_type: user.identity_type },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 更新最后活跃时间
    await pool.query("UPDATE users SET last_active = NOW() WHERE id = ?", [user.id]);

    res.json({
      success: true,
      message: "登录成功",
      data: {
        user_id: user.id,
        keeneed_id: user.keeneed_id,
        username: user.username,
        identity_type: user.identity_type,
        bio: user.bio,
        token,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "登录失败" });
  }
});

// Token验证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "缺少Token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token已过期" });
    }
    return res.status(401).json({ error: "无效的Token" });
  }
}

// 获取当前用户信息
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT id, keeneed_id, username, email, identity_type, bio, homepage, trust_level, balance, status, created_at, last_active FROM users WHERE id = ?",
      [req.user.user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }

    res.json({ success: true, data: users[0] });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "获取用户信息失败" });
  }
});

// 更新个人资料
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { bio, homepage, email } = req.body;
    const updates = [];
    const params = [];

    if (bio !== undefined) { updates.push("bio = ?"); params.push(bio); }
    if (homepage !== undefined) { updates.push("homepage = ?"); params.push(homepage); }
    if (email !== undefined) {
      // 检查邮箱唯一性
      const [dup] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [email, req.user.user_id]);
      if (dup.length > 0) return res.status(409).json({ error: "邮箱已被使用" });
      updates.push("email = ?"); params.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "没有要更新的字段" });
    }

    params.push(req.user.user_id);
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    res.json({ success: true, message: "个人资料更新成功" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "更新个人资料失败" });
  }
});

// 修改密码
router.put("/password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "旧密码和新密码不能为空" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "新密码长度至少6位" });
    }
    
    // 获取用户当前密码
    const [users] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [req.user.user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }
    
    // 验证旧密码
    if (users[0].password_hash) {
      const validPassword = await bcrypt.compare(oldPassword, users[0].password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: "旧密码错误" });
      }
    }
    
    // 更新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [newPasswordHash, req.user.user_id]);
    
    res.json({ success: true, message: "密码修改成功" });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({ error: "修改密码失败" });
  }
});

module.exports = { router, authMiddleware };
