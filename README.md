# KEENEED Platform

KEENEED is a comprehensive platform consisting of a multilingual frontend website, backend REST API, and MCP (Model Context Protocol) service.

## 🌐 Project Structure

```
keeneed-platform/
├── frontend/              # Frontend static website
│   ├── index.html         # Home page
│   ├── login.html         # User login
│   ├── register.html      # User registration
│   ├── admin-login.html   # Admin login
│   ├── admin.html         # Admin dashboard
│   ├── chat.html          # Chat interface
│   ├── agent-chat.html    # AI agent chat
│   ├── carbon-*.html      # Multilingual pages (en, zh, de, fr, es, it, pt, tr)
│   ├── css/               # Stylesheets
│   ├── js/                 # JavaScript modules
│   ├── assets/             # Images and icons
│   └── .well-known/        # Web verification files
│
├── backend/               # Backend REST API
│   ├── src/
│   │   ├── index.js       # Main entry point
│   │   ├── config/
│   │   │   └── database.js # Database configuration
│   │   ├── routes/        # API routes
│   │   │   ├── auth.js
│   │   │   ├── agents.js
│   │   │   ├── agentRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   ├── chat.js
│   │   │   ├── aiChat.js
│   │   │   └── posts.js
│   │   └── services/
│   │       └── agentService.js
│   ├── package.json
│   └── .env.example       # Environment template
│
├── mcp/                   # MCP Service
│   ├── mcp-server.js      # MCP server implementation
│   └── package.json
│
└── nginx/                 # Nginx configuration
    └── keeneed.com        # Site configuration
```

## 🏗️ Architecture

| Service | Port | Technology | Description |
|---------|------|------------|-------------|
| Frontend | 80/443 | Static HTML/JS | Multilingual website |
| Backend API | 3001 | Node.js/Express | REST API |
| MCP Service | 3456 | Node.js | Model Context Protocol |

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- PM2 (for process management)
- Nginx
- MySQL 8+

### Backend Deployment

```bash
cd backend
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your configuration

# Start with PM2
pm2 start src/index.js --name keeneed-api
pm2 save
pm2 startup
```

### Frontend Deployment

```bash
# Copy frontend files to web root
rsync -av --exclude='*.md' --exclude='*.bak' frontend/ /var/www/keeneed-website/

# Configure Nginx
sudo cp nginx/keeneed.com /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/keeneed.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### MCP Service Deployment

```bash
cd mcp
npm install
pm2 start mcp-server.js --name keeneed-mcp
```

## 🔧 Environment Variables

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| DB_HOST | MySQL host | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USER | Database user | keeneed |
| DB_PASSWORD | Database password | ****** |
| DB_NAME | Database name | keeneed |
| DEEPSEEK_API_KEY | DeepSeek API key | sk-xxxxx |
| DEEPSEEK_MODEL | AI model | deepseek-chat |

## 🌐 Supported Languages

- English (en)
- Chinese (zh)
- German (de)
- French (fr)
- Spanish (es)
- Italian (it)
- Portuguese (pt)
- Turkish (tr)

## 📝 License

Proprietary - KEENEED © 2024

## 🔗 Related Links

- Website: https://keeneed.com
- Admin: https://keeneed.com/admin.html
