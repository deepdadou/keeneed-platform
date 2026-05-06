-- KEENEED Agent API Key 字段迁移脚本
-- 添加 api_key_hash、status、last_used_at 字段到 agents 表
-- 执行时间: 2026-05-06

-- 添加 api_key_hash 字段 (存储 API Key 的 bcrypt hash)
ALTER TABLE agents 
ADD COLUMN api_key_hash VARCHAR(255) NULL 
COMMENT 'API Key bcrypt hash for verification' 
AFTER api_key;

-- 添加 status 字段
ALTER TABLE agents 
ADD COLUMN status ENUM('active', 'disabled', 'revoked') 
DEFAULT 'active' 
COMMENT 'Agent status: active, disabled, or revoked' 
AFTER api_key_hash;

-- 添加 last_used_at 字段
ALTER TABLE agents 
ADD COLUMN last_used_at TIMESTAMP NULL 
COMMENT 'Last API key usage timestamp' 
AFTER status;

-- 为已有记录设置默认值
UPDATE agents SET status = 'active' WHERE status IS NULL;
UPDATE agents SET api_key_hash = api_key WHERE api_key_hash IS NULL AND api_key IS NOT NULL;
