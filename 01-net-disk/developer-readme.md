# my-net-disk · 局域网文件管理服务

桌面端运行服务，手机 / PC 通过浏览器访问，实现局域网内文件浏览、上传、下载和管理。

**技术栈**：Node.js (Fastify) + Vue 3 (Vite) + Ant Design Vue + SQLite (sql.js)

---

## 快速开始

### 环境要求

- Node.js 18+

### 开发模式

```bash
# 1. 安装依赖
cd server && npm install
cd ../web && npm install

# 2. 启动服务端（自动监听文件变更）
cd server && npm run dev

# 3. 启动前端开发服务器（热更新）
cd web && npm run dev
```

### 生产部署

```bash
# 1. 构建前端
cd web && npm run build

# 2. 构建安装包
cd ../server && npm run build:release

# 3. 压缩 release/ 目录为 zip 分发给用户
# 用户解压后双击 start.bat 即可启动
```

### 直接运行（开发环境）

```bash
cd server && npm start
```

浏览器自动打开 `http://127.0.0.1:3000`，默认进入管理端仪表盘。

---

## 项目结构

```
my-net-disk/
├── server/                    # 后端 Fastify 服务
│   ├── src/
│   │   ├── index.js           # 入口：加载配置 → 初始化 DB → 启动 HTTP
│   │   ├── app.js             # Fastify 应用装配（插件、路由、静态文件）
│   │   ├── config.js          # 配置加载 / 合并 / 保存
│   │   ├── db.js              # SQLite 初始化 + API 封装
│   │   ├── routes/            # API 路由（files / upload / download / admin）
│   │   ├── services/          # 业务逻辑（fileManager）
│   │   ├── middleware/         # 安全校验（路径穿越防护）
│   │   └── utils/             # 工具（network / qrcode）
│   ├── config/default.json    # 默认配置
│   └── data/                  # SQLite 数据库（自动生成）
├── web/                       # 前端 Vue 3 SPA
│   ├── src/
│   │   ├── pages/admin/       # Dashboard / FileManager / Settings
│   │   ├── pages/client/      # FileBrowser（客户端文件浏览）
│   │   ├── components/        # FileList / QrcodePanel / UploadDialog
│   │   └── utils/             # api.js / chunkedUpload.js
│   └── dist/                  # 构建产物，服务端静态托管
├── release/                   # 打包输出目录
├── docs/                      # 需求文档
├── README.md                  # 用户使用说明
└── developer-readme.md        # 本文件（开发者文档）
```

---

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | → 重定向到 `/admin` | 默认打开管理端 |
| `/admin` | Dashboard | 仪表盘：服务状态、内存、快速入口、二维码 |
| `/admin/files` | FileManager | 文件管理：浏览、新建/重命名/删除文件夹、删除文件 |
| `/admin/settings` | Settings | 系统配置：端口、存储路径、上传/下载参数、访问控制 |
| `/browse` | FileBrowser | 客户端：文件浏览、下载、上传 |

---

## 功能概览

### 客户端（`/browse`）

- **文件浏览**：网格视图展示目录内容，支持面包屑导航
- **文件下载**：点击文件触发浏览器下载，支持流式传输
- **文件上传**：分片上传，支持大文件，断点续传（基于分片状态查询）

### 管理端（`/admin`）

- **仪表盘**：服务运行时长、内存占用、监听端口、存储路径概览
- **文件管理**：下载目录 / 上传目录双 Tab 切换，支持新建文件夹、重命名、删除
- **系统配置**：Web 页面修改全部配置项，保存后写入 `config/user.json`
- **二维码面板**：右下角悬浮按钮，展开显示局域网访问二维码，手机扫码即用
- **一键打开目录**：在资源管理器中打开本地文件夹

### 安全设计

- **路径穿越防护**：所有文件操作经过 `validatePath()` 校验，禁止 `..` 越权
- **管理端仅本机访问**：Admin API 默认仅允许 `127.0.0.1` 访问（`admin.allowRemote` 控制）
- **文件名过滤**：创建文件夹 / 上传时自动过滤非法字符

---

## API 接口

### 文件浏览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/files?path=/&root=download` | 列出目录内容 |
| `GET` | `/api/files/info?path=/file.mp4&root=download` | 获取文件信息 |
| `GET` | `/api/download?path=/file.mp4&root=download` | 下载文件（流式） |

### 上传

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload/init` | 初始化上传任务，返回 uploadId + chunkSize |
| `POST` | `/api/upload/chunk` | 上传单个分片（multipart） |
| `GET` | `/api/upload/status/:uploadId` | 查询上传进度，返回已完成分片索引 |
| `POST` | `/api/upload/complete/:uploadId` | 合并分片，完成后清理临时文件 |
| `GET` | `/api/upload/tasks` | 查询最近 50 条上传任务 |

### 管理端

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/status` | 服务运行状态（uptime、内存、磁盘） |
| `GET` | `/api/admin/config` | 获取当前完整配置 |
| `PUT` | `/api/admin/config` | 更新配置（写入 user.json，重启生效） |
| `GET` | `/api/admin/qrcode` | 获取局域网访问二维码 SVG |
| `POST` | `/api/admin/folder` | 新建文件夹 |
| `PUT` | `/api/admin/folder` | 重命名文件夹 |
| `DELETE` | `/api/admin/folder` | 删除空文件夹 |
| `DELETE` | `/api/admin/file` | 删除文件 |
| `POST` | `/api/admin/open-folder` | 在系统资源管理器中打开目录 |

---

## 配置说明

配置文件位于 `server/config/default.json`，通过管理端 Settings 页面修改后保存到 `config/user.json` 并合并覆盖。

### server — 服务基础配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `port` | number | `3000` | 监听端口 |
| `host` | string | `"0.0.0.0"` | 绑定地址，`127.0.0.1` 仅本机 |
| `autoOpen` | boolean | `true` | 启动时自动打开浏览器 |

### storage — 存储路径

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `downloadDir` | string | `E://my-netdisk/files/download` | 下载 / 客户端浏览目录 |
| `uploadDir` | string | `E://my-netdisk/files/upload` | 上传目录 |
| `tempDir` | string | `E://my-netdisk/files/temp` | 上传分片临时目录 |

> 目录不存在时启动服务会自动创建。

### upload — 上传参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxFileSize` | number | `10737418240` (10GB) | 单文件最大体积 |
| `maxBatchSize` | number | `21474836480` (20GB) | 批量上传最大总体积 |
| `chunkSize` | number | `10485760` (10MB) | 分片大小 |
| `maxConcurrent` | number | `3` | 并发上传分片数 |
| `mergeTimeout` | number | `600000` (10min) | 分片合并超时 |
| `cleanupTemp` | boolean | `true` | 合并完成后清理临时分片 |

### download — 下载参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `streamHighWaterMark` | number | `1048576` (1MB) | 下载流缓冲区大小 |

### admin — 管理端

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `allowRemote` | boolean | `false` | 是否允许远程访问管理端 API |
| `username` | string | `""` | 管理端登录用户名（预留） |
| `password` | string | `""` | 管理端登录密码（预留） |

### access — 访问控制

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `qrcodeEnabled` | boolean | `true` | 是否启用二维码 |
| `qrcodeRefreshInterval` | number | `0` | 二维码刷新间隔（0=不刷新） |
| `localOnly` | boolean | `false` | 是否仅允许本机访问所有服务 |

### qrcode — 二维码样式

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `size` | number | `200` | 二维码尺寸（像素） |
| `color` | string | `"#000000"` | 二维码颜色 |
| `bgColor` | string | `"#FFFFFF"` | 背景色 |

### logging — 日志

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `false` | 是否启用日志（预留） |
| `retentionDays` | number | `30` | 日志保留天数（预留） |

---

## 安装包结构

```
release/
├── server.js         # 打包后的服务端（esbuild 打包 CJS）
├── node_modules/     # 运行时依赖
├── config/
│   └── default.json  # 默认配置
├── web/              # 前端构建产物
├── data/             # SQLite 数据库（运行后自动生成）
├── start.bat         # Windows 双击启动
└── README.md
```
