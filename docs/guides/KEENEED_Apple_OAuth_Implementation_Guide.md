# KEENEED Apple OAuth 登录实现指南

## 第一步：Apple Developer 后台配置

### 1.1 登录 Apple Developer
访问 https://developer.apple.com 并登录您的开发者账号

### 1.2 创建 App ID
1. 进入 **Certificates, Identifiers & Profiles**
2. 点击 **Identifiers** → **+** 创建新的 App ID
3. 选择 **App IDs** → **Continue**
4. 配置：
   - **Description**: KEENEED
   - **Bundle ID**: `com.keeneed.app`
5. 在 **Capabilities** 中勾选 **Sign in with Apple**
6. 点击 **Continue** → **Register**

### 1.3 创建 Service ID (Client ID)
1. 在 Identifiers 页面点击 **+**
2. 选择 **Services IDs** → **Continue**
3. 配置：
   - **Description**: KEENEED Web
   - **Identifier**: `com.keeneed.app.web`
4. 勾选 **Sign in with Apple**
5. 点击 **Continue** → **Register**

### 1.4 配置回调 URL
1. 在 Identifiers 列表中找到 `com.keeneed.app.web`
2. 点击进入编辑页面
3. 在 **Sign in with Apple** 配置中：
   - 点击 **Configure**
   - **Web Domain**: `keeneed.com`
   - **Return URLs**: `https://keeneed.com/api/auth/apple/callback`
4. 保存

### 1.5 创建 API Key (.p8 文件)
1. 进入 **Keys** → **+** 创建新 Key
2. 配置：
   - **Key Name**: KEENEED Sign In Key
   - 勾选 **Sign in with Apple**
3. 点击 **Configure**：
   - **Enable as a primary key?**: 是
4. 点击 **Continue** → **Register**
5. **下载 .p8 文件**（只能下载一次！）

### 1.6 记录配置信息
完成配置后，请记录以下信息：

| 配置项 | 示例值 | 说明 |
|--------|--------|------|
| Team ID | `XXXXXXXXXX` | 团队ID，在Apple Developer右上角可见 |
| Service ID (Client ID) | `com.keeneed.app.web` | Web应用的服务ID |
| Key ID | `XXXXXXXXXX` | 密钥的标识符 |
| Private Key (.p8) | `-----BEGIN PRIVATE KEY-----...` | 下载的.p8文件内容 |

---

## 第二步：服务器配置

### 2.1 安装依赖
```bash
cd /root/keeneed/
npm install apple-signin-auth jsonwebtoken
```

### 2.2 配置环境变量
编辑 `.env` 文件或添加环境变量：

```bash
# Apple OAuth配置
APPLE_TEAM_ID=XXXXXXXXXX          # 您的Team ID
APPLE_CLIENT_ID=com.keeneed.app.web  # Service ID
APPLE_KEY_ID=XXXXXXXXXX           # Key ID
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMG...\n-----END PRIVATE KEY-----\n"  # .p8文件内容（注意换行符用\n）

# 数据库配置（如果未配置）
DB_HOST=localhost
DB_USER=keeneed
DB_PASSWORD=your_password
DB_NAME=keeneed

# JWT配置
JWT_SECRET=your_secure_jwt_secret_key
```

### 2.3 修改 .p8 文件格式
.p8 文件内容需要处理成单行（用于环境变量）：

```bash
# 将多行.p8文件转换为单行
awk '{printf "%s\\n", $0}' AuthKey_XXXXXXXXXX.p8
```

---

## 第三步：集成到后端代码

### 3.1 集成路由
在 `index.js` 中添加以下内容：

```javascript
const appleAuthRouter = require('./apple-oauth-router');

// 添加session中间件支持（如果还没有）
const session = require('express-session');
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true }
}));

// 添加Apple OAuth路由
app.use('/api/auth', appleAuthRouter);
```

### 3.2 添加数据库字段
如果 users 表还没有 apple_id 字段，需要添加：

```sql
ALTER TABLE users ADD COLUMN apple_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(50) DEFAULT 'local';
```

---

## 第四步：前端配置

### 4.1 引入 Apple JS SDK
在 HTML 中添加 Apple Sign In SDK：

```html
<script type="text/javascript" src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1.${version}/appleid.auth.js" defer></script>
```

### 4.2 修改登录按钮
在 `login.html` 和 `register.html` 中配置 Apple 按钮：

```html
<!-- Apple登录按钮 -->
<div id="appleid-signin" 
     data-color="black" 
     data-border="true" 
     data-type="sign in"></div>

<script>
  AppleID.auth.init({
    clientId : 'com.keeneed.app.web',
    scope : 'email',
    redirectURI : 'https://keeneed.com/api/auth/apple/callback',
    state : 'user_auth',
    usePopup : true
  });
</script>
```

### 4.3 前端处理登录
```javascript
// 点击Apple登录按钮
document.getElementById('appleid-signin').addEventListener('click', () => {
  AppleID.auth.signIn().then(response => {
    // 处理成功响应
    console.log('Apple登录成功:', response);
    
    // 发送authorization到后端验证
    fetch('/api/auth/apple/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorization: response.authorization
      })
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          // 登录成功，跳转到首页
          window.location.href = '/';
        }
      });
  }).catch(error => {
    console.error('Apple登录失败:', error);
  });
});
```

---

## 第五步：测试部署

### 5.1 重启服务
```bash
# 重启PM2
pm2 restart keeneed-api

# 查看日志确认启动成功
pm2 logs keeneed-api
```

### 5.2 测试步骤
1. 访问 `https://keeneed.com/register`
2. 点击 "Sign in with Apple" 按钮
3. 使用Apple账号授权
4. 验证登录成功并跳转到首页

### 5.3 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 401 错误 | Private Key 格式错误 | 确保换行符正确转换 |
| redirect_uri_mismatch | 回调URL配置不匹配 | 检查Apple后台配置的URL |
| invalid_client | Client ID 配置错误 | 确认Service ID正确 |
| 页面空白 | CORS问题 | 添加CORS中间件 |

---

## 第六步：生产环境检查清单

- [ ] Apple Developer 后台配置完成
- [ ] 环境变量已设置
- [ ] 依赖包已安装
- [ ] 数据库字段已添加
- [ ] 路由已集成到 index.js
- [ ] PM2 已重启
- [ ] HTTPS 证书有效
- [ ] 测试登录成功
- [ ] 错误日志监控正常
