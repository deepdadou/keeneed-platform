server {
    server_name keeneed.com www.keeneed.com;
    root /var/www/keeneed-website;
    index index.html index.htm;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # .well-known 静态文件
    location ^~ /.well-known/ {
        add_header Content-Type application/json;
    }
    
    # /health 健康检查 - 代理到后端
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
    }
    
    # /ai-manifest.json 静态文件
    location = /ai-manifest.json {
        add_header Content-Type application/json;
    }
    
    # API代理到3001
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
    }
    
    # MCP service
    location /mcp {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/keeneed.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/keeneed.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}
server {
    if ($host = keeneed.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name keeneed.com www.keeneed.com;
    return 404; # managed by Certbot


}
