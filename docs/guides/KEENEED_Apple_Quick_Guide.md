# KEENEED Apple登录 - 快速实施指南

## 📋 实施清单

### 一、您需要在Apple Developer完成（30分钟）

1. **访问**: https://developer.apple.com
2. **创建App ID**: 
   - Identifiers → + → App IDs
   - Bundle ID: `com.keeneed.app`
   - 勾选 "Sign in with Apple"

3. **创建Service ID**:
   - Identifiers → + → Services IDs
   - Identifier: `com.keeneed.app.web`
   - 配置Return URL: `https://keeneed.com/api/auth/apple/callback`

4. **创建API Key**:
   - Keys → + → 名称自定
   - 勾选 "Sign in with Apple"
   - 下载.p8文件（只可下载一次！）

5. **记录以下信息**:
   - Team ID (右上角可见)
   - Service ID: `com.keeneed.app.web`
   - Key ID
   - .p8文件内容

---

### 二、服务器部署（10分钟）

SSH连接服务器：
```bash
ssh keeneed@your-server-ip
```

或在阿里云控制台使用VNC连接

#### 步骤1: 安装依赖
```bash
cd /root/keeneed
npm install apple-signin-auth
```

#### 步骤2: 添加环境变量
```bash
# 编辑 ~/.bashrc 或使用pm2 env
export APPLE_TEAM_ID="您的Team ID"
export APPLE_CLIENT_ID="com.keeneed.app.web"
export APPLE_KEY_ID="您的Key ID"
export APPLE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n您的.p8内容\n-----END PRIVATE KEY-----\n'
```

#### 步骤3: 修改数据库
```sql
-- 连接MySQL
mysql -u keeneed -p keeneed

-- 添加字段
ALTER TABLE users ADD COLUMN apple_id VARCHAR(255) UNIQUE;
```

#### 步骤4: 集成代码
将 `apple-oauth-patch.js` 的内容添加到 `/root/keeneed/index.js` 末尾

#### 步骤5: 重启服务
```bash
pm2 restart keeneed-api
pm2 logs keeneed-api --lines 20
```

---

### 三、测试验证

1. 访问 https://keeneed.com/register
2. 点击 Apple 登录按钮
3. 使用Apple账号授权
4. 确认登录成功并跳转

---

### 四、已创建的文件

| 文件 | 说明 |
|------|------|
| `apple-oauth-patch.js` | 直接添加到index.js的代码 |
| `apple-oauth-router.js` | 独立路由模块（可选） |
| `KEENEED_Apple_OAuth_Implementation_Guide.md` | 完整实施文档 |

---

## ⚠️ 重要注意事项

1. **.p8文件只能下载一次** - 请妥善保管
2. **Apple回调是POST请求** - 不要配置成GET
3. **首次登录会返回用户姓名** - 需要立即保存
4. **后续登录只返回email** - 用apple_id作为唯一标识
