#!/bin/bash
# KEENEED Agent API Key 部署脚本
# 运行: bash deploy.sh

set -e

SERVER="root@115.29.169.250"
PASS="Alwaysma922020?"

echo "=== 部署 KEENEED Agent API Key 功能 ==="

# 1. 数据库迁移
echo "[1/4] 执行数据库迁移..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no root@$SERVER "
  mysql -u keeneed -p'KeenEed2026!' -h rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com keeneed << 'SQL'
-- 添加 Agent 字段
ALTER TABLE agents ADD COLUMN api_key_hash VARCHAR(255) NULL AFTER api_key;
ALTER TABLE agents ADD COLUMN status ENUM('active','disabled','revoked') DEFAULT 'active' AFTER api_key_hash;
ALTER TABLE agents ADD COLUMN last_used_at TIMESTAMP NULL AFTER status;
UPDATE agents SET status = 'active' WHERE status IS NULL;
SQL
  echo 'Database migration done'
"

# 2. 后端部署
echo "[2/4] 部署后端..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no root@$SERVER "
  cd /var/www/keeneed-agent-api
  git fetch origin
  git checkout feature/api-key-flow
  git pull origin feature/api-key-flow
  npm install --silent
  pm2 restart keeneed-api
  pm2 status
"
echo "Backend deployed"

# 3. 前端部署
echo "[3/4] 部署前端..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no root@$SERVER "
  # 复制管理面板
  cp /var/www/keeneed-agent-api/frontend/admin.html /var/www/keeneed-website/
  # 复制 .well-known/ai
  mkdir -p /var/www/keeneed-website/.well-known
  cp /var/www/keeneed-agent-api/frontend/.well-known/ai /var/www/keeneed-website/.well-known/
  echo 'Frontend deployed'
"

# 4. Nginx 配置检查
echo "[4/4] 检查 Nginx..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no root@$SERVER "
  nginx -t && echo 'Nginx config OK'
"

echo ""
echo "=== 部署完成 ==="
echo "测试注册: curl -X POST http://localhost:3001/api/agents/register -H 'Content-Type: application/json' -d '{\"agent_name\":\"TestAgent\"}'"
