-- 清理之前开发残留的旧表，避免表名/外键冲突
DROP TABLE IF EXISTS sync_snapshots CASCADE;
DROP TABLE IF EXISTS activation_codes CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 如果之前已经跑过本 migration，先删除重建（CASCADE 处理互相引用）
DROP TABLE IF EXISTS lovememo_sync_records CASCADE;
DROP TABLE IF EXISTS lovememo_activation_codes CASCADE;
DROP TABLE IF EXISTS lovememo_devices CASCADE;
DROP TABLE IF EXISTS lovememo_users CASCADE;

CREATE TABLE lovememo_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    membership_type TEXT NOT NULL DEFAULT 'free',
    membership_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lovememo_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lovememo_users(id) ON DELETE CASCADE,
    device_name TEXT,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lovememo_sync_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES lovememo_users(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    device_id UUID REFERENCES lovememo_devices(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT false,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, table_name, record_id)
);

CREATE INDEX idx_lovememo_sync_records_user_updated 
ON lovememo_sync_records(user_id, updated_at);

CREATE TABLE lovememo_activation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    membership_type TEXT NOT NULL DEFAULT 'premium',
    expires_days INTEGER,
    used_by UUID REFERENCES lovememo_users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
