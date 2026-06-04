# my-net-disk · 项目开发规范

## 项目定位
局域网文件管理服务，桌面端运行服务，移动端/PC 通过浏览器访问。
技术栈：Node.js (Fastify) + Vue 3 (Vite) + Ant Design Vue + SQLite (sql.js)。

## 项目结构
```
my-net-disk/
├── server/                  # 后端 Fastify 服务
│   ├── src/
│   │   ├── index.js         # 入口：加载配置 → 初始化 DB → 启动 HTTP
│   │   ├── app.js           # Fastify 应用装配（插件、路由、静态文件）
│   │   ├── config.js        # 配置加载/合并/保存
│   │   ├── db.js            # SQLite 初始化 + API 封装（dbRun/dbGet/dbAll）
│   │   ├── routes/          # API 路由（files/upload/download/admin）
│   │   ├── services/        # 业务逻辑（fileManager）
│   │   ├── middleware/       # 安全校验（路径穿越防护）
│   │   └── utils/           # 工具（network: 获取局域网 IP, qrcode: SVG 二维码生成）
│   ├── config/
│   │   └── default.json     # 默认配置
│   └── data/                # SQLite 数据库文件（自动生成）
├── web/                     # 前端 Vue 3 SPA
│   ├── src/
│   │   ├── pages/admin/     # Dashboard / FileManager / Settings
│   │   ├── pages/client/    # FileBrowser
│   │   ├── components/      # FileList / QrcodePanel / UploadDialog
│   │   └── utils/           # api.js（请求封装）/ chunkedUpload.js（分片上传逻辑）
│   └── dist/                # 构建产物，服务端静态托管
└── docs/                    # 需求文档
```

## 开发命令
| 操作 | 命令 |
|------|------|
| 启动服务端 | `cd server && npm run dev` |
| 启动前端开发 | `cd web && npm run dev` |
| 构建前端 | `cd web && npm run build` |
| 生产运行（构建前端后） | `cd server && npm start` |

## 关键约定
- 后端使用 ESM (`type: "module"`)。
- SQLite 使用 sql.js（纯 JS，无编译依赖），API 封装在 db.js 的 `dbRun/dbGet/dbAll`。
- 文件路径校验：所有文件操作必须经过 `middleware/security.js` 的 `validatePath()` 防止目录穿越。
- 管理端 API 默认仅本机访问（`admin.allowRemote` 控制）。
- 存储路径：下载目录与上传临时目录隔离，在 `config/default.json` 配置。
- 前端使用 Hash 路由（`createWebHashHistory`），适配静态文件部署。
- 配置修改通过管理端 Web 页面操作，存储为 `config/user.json`，合并到默认配置上。
