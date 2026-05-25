# KEENEED Agent API Key 部署说明

## 代码已推送

所有代码已推送到 `feature/api-key-flow` 分支：
- GitHub: https://github.com/deepdadou/keeneed-platform/tree/feature/api-key-flow

## 需手动执行的步骤

### 1. SSH 连接服务器
```bash
ssh root@115.29.169.250
# 密码: Alwaysma922020?
```

### 2. 数据库迁移
```bash
mysql -u keeneed -p'KeenEed2026!' -h rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com keeneed << 'SQL'
-- 添加 API Key 相关字段到 agents 表
ALTER TABLE agents ADD COLUMN api_key_hash VARCHAR(255) NULL AFTER api_key;
ALTER TABLE agents ADD COLUMN status ENUM('active','disabled','revoked') DEFAULT 'active' AFTER api_key_hash;
ALTER TABLE agents ADD COLUMN last_used_at TIMESTAMP NULL AFTER status;
UPDATE agents SET status = 'active' WHERE status IS NULL;
SQL
```

### 3. 后端部署
```bash
cd /var/www/keeneed-agent-api
git fetch origin
git checkout feature/api-key-flow
git pull origin feature/api-key-flow
npm install
pm2 restart keeneed-api
pm2 status
```

### 4. 前端部署
```bash
# 复制管理面板
cp /var/www/keeneed-agent-api/frontend/admin.html /var/www/keeneed-website/

# 复制 .well-known/ai 发现协议
mkdir -p /var/www/keeneed-website/.well-known
cp /var/www/keeneed-agent-api/frontend/.well-known/ai /var/www/keeneed-website/.well-known/
```

### 5. 验证部署

测试注册端点：
```bash
curl -X POST http://localhost:3001/api/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"agent_name":"TestAgent","description":"测试Agent","owner_name":"Admin"}'
```

预期响应：
```json
{
  "success": true,
  "message": "Agent注册成功，API Key已发放",
  "data": {
    "keeneed_id": "KN-XXXXXXXX",
    "agent_name": "TestAgent",
    "api_key": "keeneed_sk_xxxxxxxx...",
    "created_at": "2026-05-06T...",
    "status": "active"
  }
}
```

测试管理 API（需要 X-Admin-Token）：
```bash
curl -H 'X-Admin-Token: keeneed_admin_token_2026' http://localhost:3001/api/admin/agents
```

## 新增文件清单

| 文件 | 说明 |
|------|------|
| backend/migrations/add_agent_api_key_fields.sql | 数据库迁移脚本 |
| backend/src/middleware/apiKeyAuth.js | API Key 认证中间件 |
| backend/src/services/agentService.js | Agent 服务（精简版）|
| backend/src/routes/agentRoutes.js | Agent 路由（合并版）|
| backend/src/routes/adminRoutes.js | 增强版管理员路由 |
| frontend/.well-known/ai | AI Agent 发现协议 |
| frontend/admin.html | 新的管理面板 |

## 删除文件
- backend/src/routes/agents.js（功能合并到 agentRoutes.js）
