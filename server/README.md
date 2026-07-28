# LoveMemo Server

Rust/Axum 后端，连接 Neon PostgreSQL，提供注册登录、云端同步、会员激活服务。

## 启动

1. 复制环境变量文件：
   ```bash
   cp .env.example .env
   ```

2. 在 `.env` 中填入你的 Neon `DATABASE_URL` 和 `JWT_SECRET`。

3. 运行：
   ```bash
   cargo run
   ```

## 生成激活码（手动）

在 Neon 数据库执行：

```sql
INSERT INTO activation_codes (code, membership_type, expires_days)
VALUES ('YOUR-CODE-HERE', 'premium', 365);
```
