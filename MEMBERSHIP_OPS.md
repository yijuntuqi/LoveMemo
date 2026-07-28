# LoveMemo 会员与激活码操作指南

## 1. 有人付款后，如何在数据库中升级其会员等级？

### 方法一：使用脚本（推荐）

在 PowerShell 中执行：

```powershell
cd E:\old-new\backup\BNU_leaning\LoveMemo\server
$env:DATABASE_URL="postgresql://neondb_owner:npg_lWr7PwVk4gam@ep-restless-mountain-apojzz7w-pooler.c-7.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
python scripts\upgrade_user.py --email 用户邮箱@example.com --days 365
```

参数说明：
- `--email`：付款用户的注册邮箱（必填）
- `--days`：会员有效期天数，默认 365；填 0 表示永久会员
- `--type`：会员类型，默认 `premium`

### 方法二：直接执行 SQL

连接到你的 Neon PostgreSQL，执行：

```sql
UPDATE lovememo_users
SET membership_type = 'premium',
    membership_expires_at = now() + interval '365 days',
    updated_at = now()
WHERE email = '用户邮箱@example.com';
```

升级为永久会员：

```sql
UPDATE lovememo_users
SET membership_type = 'premium',
    membership_expires_at = NULL,
    updated_at = now()
WHERE email = '用户邮箱@example.com';
```

> 注意：转账单号只是用户付款凭证，你核对收款后，用上面任一方式把对应邮箱升级为会员即可。数据库里不需要保存单号。

---

## 2. 激活码从哪里来？

### 生成激活码

在 PowerShell 中执行：

```powershell
cd E:\old-new\backup\BNU_leaning\LoveMemo\server
$env:DATABASE_URL="postgresql://你的Neon数据库连接字符串"
python scripts\generate_activation_code.py --count 5 --days 365
```

参数说明：
- `--count`：生成多少个激活码，默认 1
- `--days`：每个激活码激活后的有效期天数，默认 365；填 0 表示永久
- `--type`：会员类型，默认 `premium`

执行后会输出类似：

```
已生成 5 个激活码（类型=premium，有效期=365天）：
A1B2C3D4E5F67890
0987FEDCBA654321
...
```

### 激活码使用流程

1. 用户付款后把转账单号发给你
2. 你核对收款无误
3. 你选择一个激活码发给用户
4. 用户在「设置 → 会员中心」输入激活码点击激活
5. 后台自动将其账号升级为会员，并标记该激活码已被使用

### 查看未使用的激活码

```sql
SELECT code, membership_type, expires_days, created_at
FROM lovememo_activation_codes
WHERE used_at IS NULL
ORDER BY created_at DESC;
```

---

## 3. 环境依赖

上述脚本依赖 Python 3 和 `psycopg2`，如果未安装：

```powershell
pip install psycopg2-binary
```

`DATABASE_URL` 可以在 `E:\old-new\backup\BNU_leaning\LoveMemo\server\.env` 文件中找到。
