#!/bin/bash
# KEENEED 部署脚本
# 前置条件: 已配置 SSH key 登录服务器
# 运行: DEPLOY_SERVER=your-server bash deploy.sh

set -e

SERVER="${DEPLOY_SERVER:?请设置 DEPLOY_SERVER 环境变量}"
SERVER_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/keeneed-agent-api}"

echo "=== 部署 KEENEED ==="

# 1. 数据库迁移
echo "[1/4] 执行数据库迁移..."
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER}" "
  mysql -u \"\${DB_USER}\" -p\"\${DB_PASSWORD}\" -h \"\${DB_HOST}\" \"\${DB_NAME}\" \
    < ${DEPLOY_PATH}/backend/migrations/add_agent_api_key_fields.sql
  echo 'Database migration done'
"

# 2. 后端部署
echo "[2/4] 部署后端..."
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER}" "
  cd ${DEPLOY_PATH}
  git fetch origin
  git checkout main
  git pull origin main
  npm install --silent
  pm2 restart keeneed-api
  pm2 status
"
echo "Backend deployed"

# 3. 前端部署
echo "[3/4] 部署前端..."
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER}" "
  cp ${DEPLOY_PATH}/frontend/admin.html /var/www/keeneed-website/
  mkdir -p /var/www/keeneed-website/.well-known
  cp ${DEPLOY_PATH}/frontend/.well-known/ai /var/www/keeneed-website/.well-known/
  echo 'Frontend deployed'
"

# 4. Nginx 配置检查
echo "[4/4] 检查 Nginx..."
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER}" "
  nginx -t && echo 'Nginx config OK'
"

echo ""
echo "=== 部署完成 ==="
