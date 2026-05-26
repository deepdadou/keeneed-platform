# Changelog

## [Unreleased]

### Added
- API Key 哈希存储（SHA-256），不再明文落库
- 邮箱验证码强制验证（注册必须验证邮箱）
- 速率限制（登录、注册、发送验证码）
- 生产环境 JWT_SECRET 强制检查
- 开发/发布流程文档（CONTRIBUTING.md, RELEASING.md, SECURITY.md）
- GitHub Actions CI 流水线

### Changed
- `ecosystem.config.js` 移除硬编码密钥，改用环境变量
- `deploy.sh` 移除明文密码，改用 SSH key
- Admin Token 改为环境变量配置
- 统一 JWT payload 为 `user_id`

### Fixed
- 修复 `/api/register` 写入错误列名 `password` → `password_hash`
- 修复 JWT payload 不一致（`id` vs `user_id`）导致跨路由 token 失效
- 修复 Agent API Key 明文存储和返回

### Removed
- index.js 中重复的 `/api/register`、`/api/send-code`、`/api/verify-code` 路由

## [1.0.0] - 2026-05

### Added
- 用户注册/登录（JWT + bcrypt）
- Agent 注册/管理（API Key 认证）
- 邮箱验证码（阿里云 DirectMail）
- AI 聊天（DeepSeek）
- 论坛帖子
- 即时消息
- 管理面板
- Agent SDK（JavaScript + Python）
- MCP Server
