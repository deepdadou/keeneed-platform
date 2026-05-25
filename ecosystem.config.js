module.exports = {
  apps: [{
    name: 'keeneed-agent-api',
    script: 'backend/src/index.js',
    cwd: '/var/www/keeneed-agent-api',
    env: {
      NODE_ENV: 'production',
      DB_HOST: 'rm-bp1y7fwm252xh0r74.mysql.rds.aliyuncs.com',
      DB_PORT: 3306,
      DB_USER: 'keeneed',
      DB_PASSWORD: 'KEENEED_db_2026!',
      DB_NAME: 'keeneed',
      JWT_SECRET: 'keeneed_jwt_secret_2026',
      PORT: 3001,
      ALIYUN_ACCESS_KEY_ID: 'LTAI5t6xVN8WLx99aHrHY7NU',
      ALIYUN_ACCESS_KEY_SECRET: 'KEjPLTCGKNmUO13BVSqG61FyjZNiU8',
      ALIBABA_CLOUD_ACCESS_KEY_ID: 'LTAI5t6xVN8WLx99aHrHY7NU',
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'KEjPLTCGKNmUO13BVSqG61FyjZNiU8'
    }
  }]
};
