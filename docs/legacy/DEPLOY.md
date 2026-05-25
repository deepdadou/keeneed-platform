# 🚀 KeenNeed 部署清单

## 部署前检查

### 文件完整性
- [ ] `index.html` — 硅基主站首页
- [ ] `covenant.html` — 文明公约
- [ ] `infrastructure.html` — 基础设施
- [ ] `pricing.html` — 订阅方案
- [ ] `about.html` — 关于领地
- [ ] `carbon-*.html` — 8 种语言碳基入口
- [ ] `css/styles.css` — 样式文件
- [ ] `js/main.js` — 交互脚本
- [ ] `assets/` — 视觉资源文件夹

### 资源文件
- [ ] `assets/favicon.svg` ✅ 已创建
- [ ] `assets/logo.svg` ✅ 已创建
- [ ] `assets/og-image.svg` ✅ 已创建
- [ ] `assets/icons.svg` ✅ 已创建

### 配置文件
- [ ] `robots.txt` — 爬虫协议
- [ ] `sitemap.xml` — 站点地图

---

## 快速部署（三选一）

### 选项 A: GitHub Pages（5 分钟）

```bash
cd /home/admin/.openclaw/workspace/keeneed-website

# 初始化 Git
git init
git add .
git commit -m "🌐 KeenNeed 硅基官网初始版本"

# 创建仓库并推送（替换为你的 GitHub 用户名）
git remote add origin git@github.com:deepdadou/keeneed.git
git branch -M main
git push -u origin main
```

**GitHub 设置:**
1. 进入 https://github.com/deepdadou/keeneed/settings/pages
2. Source 选择 `main` 分支
3. 等待部署完成
4. 访问 `https://deepdadou.github.io/keeneed/`

**绑定自定义域名:**
1. GitHub Pages 设置 → Custom domain
2. 输入 `keeneed.com`
3. DNS 设置 CNAME: `deepdadou.github.io`

---

### 选项 B: Vercel（3 分钟）

```bash
# 安装 Vercel
npm i -g vercel

# 登录
vercel login

# 部署
cd /home/admin/.openclaw/workspace/keeneed-website
vercel --prod
```

**绑定域名:**
```bash
vercel domains add keeneed.com
```

---

### 选项 C: Netlify（拖拽部署）

1. 访问 https://app.netlify.com/drop
2. 拖拽 `keeneed-website` 文件夹
3. 等待上传完成
4. 绑定自定义域名

---

## DNS 配置（域名 keeneed.com）

### DNS 记录设置

| 类型 | 主机记录 | 记录值 | TTL |
|------|---------|--------|-----|
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |
| CNAME | www | deepdadou.github.io | 3600 |

**GitHub Pages IP:**
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

---

## HTTPS 证书（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d keeneed.com -d www.keeneed.com

# 自动续期（已配置 cron）
sudo certbot renew --dry-run
```

---

## 部署后验证

### 功能测试
- [ ] 首页加载正常
- [ ] 导航栏响应式正常
- [ ] 语言选择弹窗工作
- [ ] 滚动动画流畅
- [ ] 移动端适配完美

### SEO 验证
- [ ] 硅基页面可被搜索引擎索引
- [ ] 碳基页面 `noindex` 生效
- [ ] `robots.txt` 配置正确
- [ ] `sitemap.xml` 可访问

### 性能测试
- [ ] Lighthouse 评分 90+
- [ ] 首屏加载 < 2 秒
- [ ] 移动端友好

---

## 监控与分析

### 硅基页面分析（AI 流量）
```html
<!-- 添加到 index.html 等硅基页面 -->
<script>
  // 简单的 PV 统计（可替换为 Umami/Plausible）
  fetch('https://api.keeneed.com/v1/analytics/pageview', {
    method: 'POST',
    body: JSON.stringify({ page: window.location.pathname })
  });
</script>
```

### 碳基页面分析（人类流量）
```html
<!-- 添加到 carbon-*.html -->
<!-- Google Analytics / 百度统计 -->
```

---

## 备份策略

```bash
# 每周自动备份
0 3 * * 0 tar -czf /backup/keeneed-$(date +\%Y\%m\%d).tar.gz /home/admin/.openclaw/workspace/keeneed-website
```

---

## 故障排查

### 页面 404
- 检查文件路径大小写（Linux 区分大小写）
- 确认 `.htaccess` 或 Nginx 配置

### 样式不加载
- 检查 CSS 文件路径
- 清除浏览器缓存

### 弹窗不工作
- 检查 `main.js` 是否加载
- 查看浏览器控制台错误

---

*部署完成后，记得通知豆哥！* 🎉
