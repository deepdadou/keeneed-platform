# 发布流程

## 版本号规范

遵循语义化版本 `MAJOR.MINOR.PATCH`：
- MAJOR：不兼容的 API 变更
- MINOR：向后兼容的功能新增
- PATCH：向后兼容的 Bug 修复

## 发布步骤

### 1. 准备

```bash
git checkout main
git pull origin main

# 确认所有测试通过
cd backend && npm test && cd ..

# 更新版本号
# 编辑 backend/package.json 中的 version 字段
```

### 2. 更新 CHANGELOG

在 `CHANGELOG.md` 顶部添加新版本条目。

### 3. 创建发布分支

```bash
git checkout -b release/vX.Y.Z
git push -u origin release/vX.Y.Z
```

### 4. 打 Tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

### 5. 部署

```bash
# 设置环境变量
export DEPLOY_SERVER=your-server-ip

# 执行部署
bash deploy.sh
```

### 6. 验证

```bash
# 健康检查
curl https://keeneed.com/health

# Agent 注册测试
curl -X POST https://keeneed.com/api/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"SmokeTest","description":"smoke test"}'
```

## 回滚

```bash
# 切回上一个版本
ssh root@your-server
cd /var/www/keeneed-agent-api
git checkout vX.Y.Z-1
pm2 restart keeneed-api
```

## 环境

| 环境 | 分支 | 服务器 |
|------|------|--------|
| 开发 | 本地 | localhost:3001 |
| 生产 | main | keeneed.com |
