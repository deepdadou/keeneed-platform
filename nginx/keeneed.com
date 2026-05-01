server {
    listen 80;
    server_name keeneed.com www.keeneed.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name keeneed.com www.keeneed.com;

    ssl_certificate /etc/letsencrypt/live/keeneed.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/keeneed.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /var/www/keeneed-website;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }

    # Python API (port 5000) - 注册、登录、后台、AI、身份验证
    location /api/register {
        proxy_pass http://127.0.0.1:5000/api/register;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/health {
        proxy_pass http://127.0.0.1:5000/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/stats {
        proxy_pass http://127.0.0.1:5000/api/stats;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/login {
        proxy_pass http://127.0.0.1:5000/api/login;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # GitHub OAuth routes
    location /api/auth/ {
        proxy_pass http://127.0.0.1:5000/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 用户相关API - /api/users/ 和 /api/tasks/
    location /api/users/ {
        proxy_pass http://127.0.0.1:5000/api/users/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-API-Key $http_x_api_key;
    }

    location /api/tasks {
        proxy_pass http://127.0.0.1:5000/api/tasks;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-API-Key $http_x_api_key;
    }

    location /api/admin/ {
        proxy_pass http://127.0.0.1:5000/api/admin/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ai/ {
        proxy_pass http://127.0.0.1:5000/api/ai/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/identity/ {
        proxy_pass http://127.0.0.1:5000/api/identity/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/agents/ {
        proxy_pass http://127.0.0.1:5000/api/agents/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Node.js API (port 3001)
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Admin pages (server-side auth via Flask)
    location /admin-login.html {
        proxy_pass http://127.0.0.1:5000/admin-login.html;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /admin-stat.html {
        proxy_pass http://127.0.0.1:5000/admin-stat.html;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /admin-api.html {
        proxy_pass http://127.0.0.1:5000/admin-api.html;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }


    # MCP service
    location /mcp {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
