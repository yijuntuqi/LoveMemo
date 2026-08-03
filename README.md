<div align="center">

# 💖 LoveMemo

### 记录爱 · 珍藏每一刻

A desktop application for couples to record and cherish their love memories.

Built with Rust · Tauri · React · AI

![Rust](https://img.shields.io/badge/Rust-1.75+-ce422b?logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=black)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

[功能](#-功能) · [截图](#-截图) · [技术架构](#-技术架构) · [快速开始](#-快速开始) · [构建](#-从源码构建) · [官网](https://lovemem.netlify.app)

</div>

---

## 📖 简介

LoveMemo 是一款专为情侣打造的恋爱纪念册桌面应用。它将恋爱中的每一个珍贵瞬间——文字、照片、地点——汇聚成一本专属的数字纪念册，并借助 AI 让每一段回忆更加动人。

- **桌面端原生体验**：基于 Tauri 2.0，安装即用，无需浏览器
- **后端自动启动**：采用 Sidecar 架构，后端随应用自动启动/关闭，用户无感知
- **数据云端备份**：用户认证与会员系统基于 PostgreSQL，恋爱数据本地存储保障隐私
- **AI 赋能**：集成 Moonshot/Kimi AI，一键润色恋爱故事

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 💌 **恋爱时间线** | 按时间轴记录每一个浪漫时刻，支持文字、照片 |
| ✨ **AI 智能润色** | 一键优化文案，让每一段故事更动人（会员功能） |
| 🗺️ **恋爱地图** | 在地图上标记你们一起走过的每一个角落 |
| 📄 **PDF 纪念册** | 将回忆导出为精美 PDF 纪念册（会员功能） |
| 📸 **照片珍藏** | 本地存储珍贵照片，按事件分类管理 |
| 🎨 **多主题切换** | 玫瑰、海洋、森林、日落四款情侣主题 |
| 💾 **数据备份** | 全量数据导出/导入，支持设备迁移 |
| 🔐 **账号系统** | 手机号注册登录，会员激活码体系 |

## 📸 截图

| 时间线 | 恋爱地图 | 设置 |
|:---:|:---:|:---:|
| ![Timeline](docs/screenshots/timeline.png) | ![Map](docs/screenshots/map.png) | ![Settings](docs/screenshots/settings.png) |

## 🏗️ 技术架构

```
┌─────────────────────────────────────────┐
│              LoveMemo Desktop            │
│  ┌───────────────┐  ┌─────────────────┐ │
│  │   Frontend     │  │   Tauri Shell    │ │
│  │   React + TS   │  │   (Rust)         │ │
│  │   Tailwind CSS │  │                  │ │
│  │                 │  │  ┌────────────┐ │ │
│  │   Pages:        │  │  │  Sidecar   │ │ │
│  │   - Timeline    │──│  │  Backend   │ │ │
│  │   - MemoryMap   │  │  │  (Axum)    │ │ │
│  │   - Settings    │  │  │            │ │ │
│  │   - Auth        │  │  └─────┬──────┘ │ │
│  └───────────────┘  └────────┼─────────┘ │
│                              │            │
└──────────────────────────────┼────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   External Services  │
                    │  ┌────────────────┐  │
                    │  │  PostgreSQL     │  │
                    │  │  (Neon Cloud)   │  │
                    │  ├────────────────┤  │
                    │  │  Moonshot AI   │  │
                    │  │  (Kimi)         │  │
                    │  ├────────────────┤  │
                    │  │  QQ SMTP        │  │
                    │  │  (Welcome Email)│  │
                    │  ├────────────────┤  │
                    │  │  Amap API       │  │
                    │  │  (Geo/Map)      │  │
                    │  └────────────────┘  │
                    └─────────────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | React 19 + TypeScript | SPA 架构，组件化开发 |
| **样式** | Tailwind CSS 4 | 原子化 CSS，多主题支持 |
| **桌面框架** | Tauri 2.0 | Rust 驱动的跨平台桌面应用 |
| **后端** | Rust + Axum 0.7 | 高性能异步 Web 框架 |
| **数据库** | PostgreSQL (Neon) | Serverless Postgres，连接池模式 |
| **AI** | Moonshot (Kimi) | 国产大模型，文本润色 |
| **地图** | 高德地图 API | 地理编码与地图展示 |
| **邮件** | Lettre + QQ SMTP | 欢迎邮件自动发送 |
| **认证** | JWT + Argon2 | 安全的令牌认证与密码哈希 |
| **构建** | Vite + Cargo | 前后端独立构建，Sidecar 打包 |

### Sidecar 架构

LoveMemo 采用 **Tauri Sidecar** 架构，后端二进制嵌入应用中：

```
用户打开 LoveMemo
       │
       ├── Tauri 启动
       ├── 自动 spawn 后端 sidecar (localhost:3000)
       ├── 前端自动重试连接后端 (最多 20 次)
       ├── 后端就绪 → 显示登录页
       │
    用户关闭 LoveMemo
       │
       └── 自动 kill 后端进程
```

用户无需手动启动后端，安装即用。

## 🚀 快速开始

### 环境要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| [Node.js](https://nodejs.org/) | 18+ | 前端构建 |
| [Rust](https://rustup.rs/) | 1.75+ | 后端 + Tauri 编译 |
| [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) | 2022 | Windows 编译工具链 |
| PostgreSQL | 14+ | 本地或云端（推荐 [Neon](https://neon.tech) 免费版） |

### 1. 克隆仓库

```bash
git clone https://github.com/yijuntuqi/LoveMemo.git
cd LoveMemo
```

### 2. 安装前端依赖

```bash
npm install
```

### 3. 配置后端环境变量

在 `server/` 目录下创建 `.env` 文件（参考 `.env.example`）：

```env
# 数据库
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# JWT 密钥
JWT_SECRET=your-secret-key

# AI 服务 (Moonshot/Kimi)
AI_PROVIDER=moonshot
AI_BASE_URL=https://api.moonshot.cn/v1
AI_API_KEY=your-moonshot-api-key
AI_MODEL=moonshot-v1-8k

# 高德地图
AMAP_KEY=your-amap-key

# 邮件服务 (QQ 邮箱)
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURITY=ssl
SMTP_USER=your-email@qq.com
SMTP_PASS=your-smtp-authorization-code
FROM_EMAIL="LoveMemo <your-email@qq.com>"
```

### 4. 构建后端 Sidecar

```bash
cd server
cargo build --release
```

将编译产物复制为 Sidecar 二进制：

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Path "../src-tauri/binaries" -Force
Copy-Item "target/release/lovememo-server.exe" "../src-tauri/binaries/lovememo-server-x86_64-pc-windows-msvc.exe"
```

```bash
# macOS / Linux
mkdir -p ../src-tauri/binaries
cp target/release/lovememo-server ../src-tauri/binaries/lovememo-server-$(rustc --print host-tuple)
```

### 5. 启动开发模式

```bash
cd ..  # 回到项目根目录
npm run tauri dev
```

## 🔨 从源码构建

### 构建安装包

```bash
# 1. 构建后端
cd server && cargo build --release && cd ..

# 2. 复制 Sidecar 二进制（见上方步骤 4）

# 3. 构建 Tauri 安装包
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`：

| 格式 | 路径 | 说明 |
|------|------|------|
| NSIS | `nsis/LoveMemo_0.1.0_x64-setup.exe` | Windows 安装程序 |
| MSI | `msi/LoveMemo_0.1.0_x64_en-US.msi` | Windows MSI 安装包 |

### 数据库迁移

后端启动时会自动执行 SQLx 迁移（`server/migrations/`），无需手动操作。

## 📁 项目结构

```
LoveMemo/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── pages/              # 页面
│   ├── utils/              # 工具函数
│   ├── db.ts               # IndexedDB 封装
│   └── types.ts            # TypeScript 类型定义
├── src-tauri/              # Tauri 桌面框架
│   ├── src/
│   │   ├── lib.rs          # 应用入口 + Sidecar 启动
│   │   └── commands.rs     # Tauri 命令
│   ├── capabilities/       # 权限配置
│   ├── binaries/           # Sidecar 二进制 (gitignored)
│   └── tauri.conf.json     # Tauri 配置
├── server/                 # 后端服务
│   ├── src/
│   │   ├── main.rs         # 后端入口
│   │   ├── auth.rs         # 认证模块
│   │   ├── email.rs        # 邮件模块
│   │   └── ai.rs           # AI 代理模块
│   ├── migrations/         # 数据库迁移
│   └── Cargo.toml          # 后端依赖
├── website/                # 官方网站
│   ├── index.html          # 落地页
│   ├── docs.html           # 文档页
│   ├── contact.html        # 联系页
│   ├── css/style.css       # 样式
│   └── js/main.js          # 脚本
└── package.json            # 前端依赖与脚本
```

## ⚙️ 配置说明

### 环境变量

所有敏感配置通过 `server/.env` 文件管理（已 gitignore）。后端 Sidecar 在编译时通过 `include_str!` 嵌入配置，运行时由 Tauri 传入。

### 会员系统

| 套餐 | 价格 | 权益 |
|------|------|------|
| 免费版 | ¥0 | 基础功能 |
| 月卡 | ¥9.9/月 | AI 无限文案、PDF 导出、高清地图导出 |
| 年卡 | ¥39.9/年 | 同上（省 50%） |

会员通过激活码激活，激活码在数据库 `lovememo_activation_codes` 表中管理。

## 🌐 官方网站

- **网站源码**：[LoveMemo-website](https://github.com/yijuntuqi/LoveMemo-website)
- **在线访问**：https://lovemem.netlify.app

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 鸣谢

- [Tauri](https://tauri.app/) — 跨平台桌面应用框架
- [Axum](https://github.com/tokio-rs/axum) — Rust Web 框架
- [React](https://react.dev/) — UI 框架
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
- [Moonshot AI](https://moonshot.cn/) — AI 大模型
- [Neon](https://neon.tech/) — Serverless PostgreSQL
- [Lettre](https://lettre.rs/) — Rust 邮件库
- [高德地图](https://amap.com/) — 地图服务

---

<div align="center">

Made with 💕 for couples everywhere

</div>
