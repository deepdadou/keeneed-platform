const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const ADMIN_ACCOUNTS = {
  "admin": "keeneed2024",
  "laowan": "laowan2024"
};

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "用户名和密码必填" });
  }
  if (ADMIN_ACCOUNTS[username] && ADMIN_ACCOUNTS[username] === password) {
    const token = crypto.randomBytes(32).toString("hex");
    res.json({ success: true, token: token, user: username });
  } else {
    res.status(401).json({ success: false, error: "用户名或密码错误" });
  }
});

module.exports = router;
