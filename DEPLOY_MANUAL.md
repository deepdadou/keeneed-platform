# KEENEED 部署说明

## 前置条件

1. 服务器已配置 SSH key 登录
2. 服务器已安装 Node.js、PM2、Nginx、MySQL 客户端
3. 环境变量已配置（参见 `backend/.env.example`）

## 环境变量

部署前确保以下环境变量已设置：

| 变量 | 说明 |
|------|------|
| `DB_HOST` | 数据库主机地址 |
| `DB_PORT` | 数据库端口 |
| `DB_USER` | 数据库用户名 |
| `DB_PASSWORD` | 数据库密码 |
| `DB_NAME` | 数据库名 |
| `JWT_SECRET` | JWT 签名密钥（至少32字符随机字符串） |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID（DirectMail） |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `DEPLOY_SERVER` | 部署目标服务器 IP/域名 |

## 快速部署

```bash
DEPLOY_SERVER=your-server bash deploy.sh
```

## 手动部署

### 1. SSH 连接服务器
```bash
ssh root@your-server-ip
```

### 2. 数据库迁移
```bash
mysql -u $DB_USER -p"$DB_PASSWORD" -h $DB_HOST $DB_NAME < backend/migrations/add_agent_api_key_fields.sql
```

### 3. 后端部署
```bash
cd /var/www/keeneed-agent-api
git pull origin main
npm install
pm2 restart keeneed-api
pm2 status
```

### 4. 前端部署
```bash
cp frontend/admin.html /var/www/keeneed-website/
mkdir -p /var/www/keeneed-website/.well-known
cp frontend/.well-known/ai /var/www/keeneed-website/.well-known/
```

## 验证

```bash
# 健康检查
curl http://localhost:3001/health

# Agent 注册测试
curl -X POST http://localhost:3001/api/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestAgent","description":"test","owner_name":"Admin"}'
```

## 回滚

```bash
cd /var/www/keeneed-agent-api
git checkout <previous-commit>
pm2 restart keeneed-api
```
