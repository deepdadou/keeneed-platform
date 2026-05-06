const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
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

// ==========================================
// 用户注册
// ==========================================
router.post("/register", async (req, res) => {
  try {
    const { username, password, email, identity_type, bio } = req.body;

    // 必填校验
    if (!username) {
      return res.status(400).json({ error: "用户名不能为空" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "密码不能为空且至少6位" });
    }

    // 检查用户名是否已存在
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "用户名已存在" });
    }

    // 检查email是否已存在（如果提供了）
    if (email) {
      const [existingEmail] = await pool.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({ error: "邮箱已被注册" });
      }
    }

    // 密码加密 - 使用bcrypt
    const password_hash = await bcrypt.hash(password, 10);

    // 生成唯一keeneed_id
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

    // 确定identity_type
    const userType = identity_type || "human";

    // 插入用户
    const [result] = await pool.query(
      `INSERT INTO users (keeneed_id, username, email, password, identity_type, bio, status, trust_level, balance)
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
        keeneed_id,
        username,
        identity_type: userType,
        token,
      },
    });
  } catch (err) {
    console.error("Registre error:", err);
    res.status(500).json({ error: "注册失败，请稍后重试" });
  }
});

// ==========================================
// 用户登录
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }

    // 查找用户 - 注意：数据库字段是 password 不是 password_hash
    const [users] = await pool.query(
      "SELECT id, keeneed_id, username, email, password, identity_type, bio, status FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const user = users[0];

    // 检查状态
    if (user.status === "banned") {
      return res.status(403).json({ error: "账号已被封禁" });
    }

    // 验证密码
    if (!user.password) {
      return res.status(401).json({ error: "该账号未设置密码，请使用其他登录方式" });
    }

    let validPassword = false;

    // 判断密码哈希类型并进行验证
    if (user.password.startsWith("$2")) {
      // bcrypt 格式
      validPassword = await bcrypt.compare(password, user.password);
    } else if (user.password.length === 32 && /^[a-f0-9]{32}$/.test(user.password)) {
      // MD5 格式 (32位十六进制) - 向后兼容
      const md5Hash = crypto.createHash("md5").update(password).digest("hex");
      validPassword = (md5Hash === user.password);
      
      // 如果MD5验证成功，自动升级为bcrypt
      if (validPassword) {
        const newHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id]);
        console.log(`User ${username} password upgraded from MD5 to bcrypt`);
      }
    } else if (user.password.length === 40 && /^[a-f0-9]{40}$/.test(user.password)) {
      // SHA1 格式 (40位十六进制) - 向后兼容
      const sha1Hash = crypto.createHash("sha1").update(password).digest("hex");
      validPassword = (sha1Hash === user.password);
      
      // 如果SHA1验证成功，自动升级为bcrypt
      if (validPassword) {
        const newHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id]);
        console.log(`User ${username} password upgraded from SHA1 to bcrypt`);
      }
    } else {
      // 未知格式，尝试bcrypt
      validPassword = await bcrypt.compare(password, user.password);
    }

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
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
});

// ==========================================
// Token验证中间件
// ==========================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未提供认证token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token已过期，请重新登录" });
    }
    return res.status(401).json({ error: "无效的token" });
  }
}

// ==========================================
// 获取当前用户信息
// ==========================================
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

// ==========================================
// 更新用户资料
// ==========================================
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { bio, homepage, email } = req.body;
    const updates = [];
    const params = [];

    if (bio !== undefined) { updates.push("bio = ?"); params.push(bio); }
    if (homepage !== undefined) { updates.push("homepage = ?"); params.push(homepage); }
    if (email !== undefined) {
      // 检查email是否已被其他用户使用
      const [dup] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [email, req.user.user_id]);
      if (dup.length > 0) return res.status(409).json({ error: "邮箱已被其他用户使用" });
      updates.push("email = ?"); params.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "没有需要更新的字段" });
    }

    params.push(req.user.user_id);
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    res.json({ success: true, message: "资料更新成功" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "更新资料失败" });
  }
});


// ==========================================
// 邮箱验证码发送
// ==========================================
const { sendMail: directMailSend } = require("../utils/directMail");
const verificationCodes = new Map();

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
    return await directMailSend(email, "KEENEED 验证码", htmlBody);
  } catch (err) {
    console.error("Email error:", err);
    return false;
  }
}

router.post("/send-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "邮箱格式不正确" });
    }
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(409).json({ error: "该邮箱已注册" });
    const code = generateCode();
    verificationCodes.set(email, { code, createdAt: Date.now(), attempts: 0 });
    const sent = await sendVerificationEmail(email, code);
    if (!sent) return res.status(500).json({ error: "邮件发送失败" });
    res.json({ success: true, message: "验证码已发送" });
  } catch (err) {
    console.error("Send code error:", err);
    res.status(500).json({ error: "发送验证码失败" });
  }
});

router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "参数缺失" });
    const stored = verificationCodes.get(email);
    if (!stored) return res.status(400).json({ error: "未请求验证码" });
    if (Date.now() - stored.createdAt > 300000) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: "验证码已过期" });
    }
    if (stored.attempts >= 5) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: "尝试次数过多" });
    }
    if (stored.code !== code) {
      stored.attempts++;
      return res.status(400).json({ error: "验证码错误" });
    }
    verificationCodes.delete(email);
    res.json({ success: true });
  } catch (err) {
    console.error("Verify code error:", err);
    res.status(500).json({ error: "验证失败" });
  }
});

module.exports = { router, authMiddleware };
