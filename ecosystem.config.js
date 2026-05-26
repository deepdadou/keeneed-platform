module.exports = {
  apps: [{
    name: 'keeneed-agent-api',
    script: 'backend/src/index.js',
    cwd: '/var/www/keeneed-agent-api',
    env: {
      NODE_ENV: 'production',
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT || 3306,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_NAME: process.env.DB_NAME || 'keeneed',
      JWT_SECRET: process.env.JWT_SECRET,
      PORT: process.env.PORT || 3001,
      ALIYUN_ACCESS_KEY_ID: process.env.ALIYUN_ACCESS_KEY_ID,
      ALIYUN_ACCESS_KEY_SECRET: process.env.ALIYUN_ACCESS_KEY_SECRET,
      ALIBABA_CLOUD_ACCESS_KEY_ID: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET
    }
  }]
};
