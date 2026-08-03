# LoveMemo Server

Rust/Axum 后端服务，作为 Tauri Sidecar 嵌入桌面应用运行。

## 开发

```bash
# 复制环境变量
cp .env.example .env
# 编辑 .env 填入真实配置

# 构建
cargo build --release
```

构建后将二进制复制为 Sidecar：

```powershell
Copy-Item "target\release\lovememo-server.exe" "..\src-tauri\binaries\lovememo-server-x86_64-pc-windows-msvc.exe"
```

## 生成激活码

在 PostgreSQL 数据库执行：

```sql
INSERT INTO lovememo_activation_codes (code, membership_type, expires_days)
VALUES ('YOUR-CODE-HERE', 'premium', 365);
```

## API

| 端点 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/health` | GET | 健康检查 | 公开 |
| `/auth/register` | POST | 用户注册 | 公开 |
| `/auth/login` | POST | 用户登录 | 公开 |
| `/auth/me` | GET | 获取用户信息 | JWT |
| `/membership/activate` | POST | 激活会员码 | JWT |
| `/ai/polish` | POST | AI 文本润色 | JWT + 会员 |
