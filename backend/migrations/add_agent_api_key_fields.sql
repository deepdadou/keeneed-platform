-- KEENEED Agent 字段迁移脚本
-- 执行时间: 2026-05-06

-- 添加 api_key_prefix 字段 (API Key 前12字符，用于索引查找)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS api_key_prefix VARCHAR(12) NULL
COMMENT 'First 12 chars of API key for indexed lookup'
AFTER api_key;

-- 添加 api_key_hash 字段 (SHA-256 hash)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(255) NULL
COMMENT 'SHA-256 hash of API key for verification'
AFTER api_key_prefix;

-- 添加 status 字段
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS status ENUM('active', 'disabled', 'revoked')
DEFAULT 'active'
COMMENT 'Agent status'
AFTER api_key_hash;

-- 添加 last_used_at 字段
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP NULL
COMMENT 'Last API key usage timestamp'
AFTER status;

-- 为已有记录设置默认值
UPDATE agents SET status = 'active' WHERE status IS NULL;

-- 为已有 API Key 生成 hash 和 prefix（如果 api_key 有值但 hash 为空）
UPDATE agents SET
  api_key_prefix = LEFT(api_key, 12),
  api_key_hash = SHA2(api_key, 256)
WHERE api_key IS NOT NULL AND api_key_hash IS NULL;
