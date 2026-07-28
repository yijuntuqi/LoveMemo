-- 添加手机号字段，邮箱改为可选
ALTER TABLE lovememo_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE lovememo_users ALTER COLUMN email DROP NOT NULL;

-- 手机号唯一索引（排除 NULL）
CREATE UNIQUE INDEX IF NOT EXISTS lovememo_users_phone_key ON lovememo_users(phone) WHERE phone IS NOT NULL;
