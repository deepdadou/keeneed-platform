const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const { sendMail: directMailSend } = require("../utils/directMail");
const rateLimiter = require("../utils/rateLimiter");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET 环境变量未设置，生产环境必须配置！");
    process.exit(1);
  }
  console.warn("WARNING: 未设置 JWT_SECRET，使用默认值（仅用于开发）");
}
const JWT_SECRET_FINAL = JWT_SECRET || "keeneed_dev_secret_change_me_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function generateKeeneedId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "KN-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// =====================验证码存储 =====================
const verificationCodes = new Map();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) verificationCodes.delete(email);
  }
}, 5 * 60 * 1000);

async function sendVerificationEmail(email, code) {
  const htmlBody = `<html><body style="font-family:sans-serif;background:#0a0f1a;color:#e0e6ed;">
<div style="max-width:500px;margin:0 auto;background:#111827;border-radius:12px;padding:30px;">
<h2 style="color:#00f0ff;">KEENEED 验证码</h2>
<p>您的验证码是：</p>
<div style="font-size:32px;color:#00f0ff;letter-spacing:8px;">${code}</div>
<p>5分钟内有效</p>
</div></body></html>`;
  try {
    await directMailSend(email, 'KEENEED 验证码', htmlBody);
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

// =====================发送验证码 =====================
router.post("/send-code", rateLimiter({ windowMs: 60000, max: 1 }), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "邮箱不能为空" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "邮箱格式不正确" });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "该邮箱已注册" });
    }

    const code = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    verificationCodes.set(email, { code, expiresAt, attempts: 0 });

    try {
      await pool.query("DELETE FROM email_verify_codes WHERE email = ?", [email]);
      await pool.query(
        "INSERT INTO email_verify_codes (email, code, expires_at, used) VALUES (?, ?, FROM_UNIXTIME(? / 1000), 0)",
        [email, code, expiresAt]
      );
    } catch (dbError) {
      console.log("数据库存储验证码失败，使用内存存储:", dbError.message);
    }

    const sent = await sendVerificationEmail(email, code);

    if (!sent) {
      return res.status(500).json({ error: "邮件发送失败，请稍后重试" });
    }

    const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      success: true,
      message: "验证码已发送",
      ...(isDev && { code }),
      expires_in: 300
    });
  } catch (err) {
    console.error("发送验证码错误:", err);
    res.status(500).json({ error: "发送验证码失败" });
  }
});

// =====================验证验证码 =====================
router.post("/verify-code", rateLimiter({ windowMs: 60000, max: 5 }), async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "邮箱和验证码不能为空" });
    }

    const memoryData = verificationCodes.get(email);
    if (memoryData) {
      if (memoryData.attempts >= 5) {
        verificationCodes.delete(email);
        return res.status(400).json({ error: "尝试次数过多，请重新获取验证码" });
      }
      if (memoryData.code === code && memoryData.expiresAt > Date.now()) {
        memoryData.verified = true;
        try {
          await pool.query(
            "UPDATE email_verify_codes SET used = 1 WHERE email = ? AND code = ?",
            [email, code]
          );
        } catch (dbError) { /* ignore */ }
        return res.json({ success: true, message: "验证成功" });
      }
      memoryData.attempts++;
    }

    try {
      const [records] = await pool.query(
        "SELECT * FROM email_verify_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
        [email, code]
      );
      if (records.length > 0) {
        await pool.query("UPDATE email_verify_codes SET used = 1 WHERE id = ?", [records[0].id]);
        return res.json({ success: true, message: "验证成功" });
      }
    } catch (dbError) { /* ignore */ }

    res.status(400).json({ error: "验证码错误或已过期" });
  } catch (err) {
    console.error("验证验证码错误:", err);
    res.status(500).json({ error: "验证失败" });
  }
});

// =====================注册 =====================
router.post("/register", rateLimiter({ windowMs: 60000, max: 3 }), async (req, res) => {
  try {
    const { username, password, email, code, identity_type, bio } = req.body;

    if (!username) {
      return res.status(400).json({ error: "用户名不能为空" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "密码长度至少6位" });
    }

    // 如果提供了邮箱，必须验证验证码
    if (email) {
      if (!code) {
        return res.status(400).json({ error: "需要邮箱验证码" });
      }

      const memoryData = verificationCodes.get(email);
      const isVerified = memoryData && memoryData.verified && memoryData.expiresAt > Date.now();

      if (!isVerified) {
        let dbVerified = false;
        try {
          const [records] = await pool.query(
            "SELECT id FROM email_verify_codes WHERE email = ? AND code = ? AND used = 1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
            [email, code]
          );
          dbVerified = records.length > 0;
        } catch (dbError) { /* ignore */ }

        if (!dbVerified) {
          return res.status(400).json({ error: "邮箱验证码未验证或已过期" });
        }
      }
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "用户名已存在" });
    }

    if (email) {
      const [existingEmail] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
      if (existingEmail.length > 0) {
        return res.status(409).json({ error: "邮箱已被使用" });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    let keeneed_id;
    for (let i = 0; i < 10; i++) {
      keeneed_id = generateKeeneedId();
      const [dup] = await pool.query("SELECT id FROM users WHERE keeneed_id = ?", [keeneed_id]);
      if (dup.length === 0) break;
    }

    const userType = identity_type || "human";

    const [result] = await pool.query(
      `INSERT INTO users (keeneed_id, username, email, password_hash, identity_type, bio, status, trust_level, balance)
       VALUES (?, ?, ?, ?, ?, ?, "active", 1, 100.00)`,
      [keeneed_id, username, email || null, password_hash, userType, bio || null]
    );

    // 清除已验证的验证码
    if (email) {
      verificationCodes.delete(email);
    }

    const token = jwt.sign(
      { user_id: result.insertId, username, identity_type: userType },
      JWT_SECRET_FINAL,
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
    console.error("Register error:", err);
    res.status(500).json({ error: "注册失败" });
  }
});

// =====================登录 =====================
router.post("/login", rateLimiter({ windowMs: 60000, max: 5 }), async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }

    const [users] = await pool.query(
      "SELECT id, keeneed_id, username, email, password_hash, identity_type, bio, status FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const user = users[0];

    if (user.status === "banned") {
      return res.status(403).json({ error: "用户已被禁用" });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: "用户未设置密码，请使用其他方式登录" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const token = jwt.sign(
      { user_id: user.id, username: user.username, identity_type: user.identity_type },
      JWT_SECRET_FINAL,
      { expiresIn: JWT_EXPIRES_IN }
    );

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

// =====================Token验证中间件 =====================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "缺少Token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token已过期" });
    }
    return res.status(401).json({ error: "无效的Token" });
  }
}

// =====================获取当前用户 =====================
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

// =====================更新个人资料 =====================
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { bio, homepage, email } = req.body;
    const updates = [];
    const params = [];

    if (bio !== undefined) { updates.push("bio = ?"); params.push(bio); }
    if (homepage !== undefined) { updates.push("homepage = ?"); params.push(homepage); }
    if (email !== undefined) {
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

// =====================修改密码 =====================
router.put("/password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "旧密码和新密码不能为空" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "新密码长度至少6位" });
    }

    const [users] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [req.user.user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }

    if (users[0].password_hash) {
      const validPassword = await bcrypt.compare(oldPassword, users[0].password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: "旧密码错误" });
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [newPasswordHash, req.user.user_id]);

    res.json({ success: true, message: "密码修改成功" });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({ error: "修改密码失败" });
  }
});

module.exports = { router, authMiddleware };
