# 安全策略

## 报告漏洞

如发现安全漏洞，请发送邮件至 **security@keeneed.com**，不要公开提交 Issue。

我们会在 48 小时内确认并给出修复时间表。

## 安全实践

### 密钥管理

- **严禁**在代码、配置文件、注释中硬编码密钥
- 所有密钥通过环境变量注入
- 生产密钥定期轮换（建议每 90 天）
- `.env` 文件**绝不**提交到 Git

### 密码存储

- 用户密码：bcrypt（cost factor 10）
- API Key：SHA-256 哈希存储，仅创建时返回明文

### API 安全

- JWT Token 有效期 7 天
- API Key 认证：前缀索引 + SHA-256 验证
- 敏感端点启用速率限制
- 管理员 API 需要 X-Admin-Token

### 速率限制

| 端点 | 限制 |
|------|------|
| `/api/auth/send-code` | 1 次/分钟/IP |
| `/api/auth/login` | 5 次/分钟/IP |
| `/api/auth/register` | 3 次/分钟/IP |
| `/api/auth/verify-code` | 5 次/分钟/IP |

### 依赖安全

```bash
# 定期检查依赖漏洞
npm audit

# 自动修复
npm audit fix
```

### 已知道的安全改进（TODO）

- [ ] 迁移到 Redis 速率限制（当前为内存存储，多进程不共享）
- [ ] 登录失败锁定（连续失败 N 次，锁定 M 分钟）
- [ ] 双因素认证
- [ ] 审计日志
- [ ] CSP 头完善
- [ ] 自动化密钥轮换
