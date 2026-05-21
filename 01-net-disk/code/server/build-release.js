// 打包脚本：用 esbuild 打包源码 → CJS bundle + 复制依赖到 release
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const releaseDir = resolve(root, 'release');
const distDir = resolve(__dirname, 'dist');

// 清理子目录和文件（不删除根目录以避免权限问题）
for (const sub of ['config', 'data', 'web', 'node_modules']) {
  const p = resolve(releaseDir, sub);
  try { if (existsSync(p)) rmSync(p, { recursive: true, force: true }); } catch {}
}
// 清理旧 server.js
try { const oldServer = resolve(releaseDir, 'server.js'); if (existsSync(oldServer)) rmSync(oldServer); } catch {}
try { const oldBat = resolve(releaseDir, 'start.bat'); if (existsSync(oldBat)) rmSync(oldBat); } catch {}
mkdirSync(releaseDir, { recursive: true });
mkdirSync(resolve(releaseDir, 'config'), { recursive: true });
mkdirSync(resolve(releaseDir, 'data'), { recursive: true });
mkdirSync(resolve(releaseDir, 'web'), { recursive: true });
mkdirSync(resolve(releaseDir, 'node_modules'), { recursive: true });

// 1. 用 esbuild 打包源码为 CJS
console.log('[1/4] 打包源码...');
await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/server.cjs',
  external: [
    'fastify', '@fastify/*', 'sql.js', 'qrcode',
    // Node.js built-ins are handled automatically
  ],
});
console.log('  完成 -> dist/server.cjs');

// 2. 复制依赖（全量 node_modules）
console.log('[2/4] 复制依赖...');
const nmSrc = resolve(__dirname, 'node_modules');
const nmDest = resolve(releaseDir, 'node_modules');
cpSync(nmSrc, nmDest, { recursive: true });

// 3. 复制配置文件
console.log('[3/4] 复制资源...');
cpSync(resolve(__dirname, 'config/default.json'), resolve(releaseDir, 'config/default.json'));
cpSync(resolve(__dirname, 'dist/server.cjs'), resolve(releaseDir, 'server.js'));

// 前端
const webDist = resolve(root, 'web/dist');
if (existsSync(webDist)) {
  cpSync(webDist, resolve(releaseDir, 'web'), { recursive: true });
} else {
  // 创建空 web 目录和占位 index.html
  writeFileSync(resolve(releaseDir, 'web/index.html'), '<!DOCTYPE html><html><body>请先构建前端: cd web && npm run build</body></html>');
}

// 4. 启动脚本和说明
console.log('[4/4] 创建启动脚本...');
writeFileSync(resolve(releaseDir, 'start.bat'), '@echo off\r\ntitle my-net-disk\r\nnode server.js\r\npause\r\n');

// README
const readme = `# my-net-disk · 局域网文件管理服务

## 使用方法

1. 确保电脑已安装 Node.js（如未安装，先去 https://nodejs.org 下载 LTS 版本）
2. 双击 **start.bat** 启动服务
3. 浏览器自动打开管理端页面
4. 右下角二维码，手机扫码即可访问客户端

## 管理端

- 仪表盘：http://127.0.0.1:3000/#/admin
- 文件管理：http://127.0.0.1:3000/#/admin/files
- 系统配置：http://127.0.0.1:3000/#/admin/settings

## 文件夹说明

- config/default.json  — 默认配置文件
- web/                — 前端页面
- data/               — 数据库（自动生成）

## 注意事项

- 管理端仅限本机访问（安全设计）
- 客户端可在局域网任意设备访问
- 关闭命令行窗口即停止服务
`;
writeFileSync(resolve(releaseDir, 'README.md'), readme);

console.log('\n✅ Release 已构建到 release/ 目录');
console.log('   结构:');
console.log('   release/');
console.log('   ├── server.js       (打包后的服务端)');
console.log('   ├── node_modules/   (运行时依赖)');
console.log('   ├── config/         (配置文件)');
console.log('   ├── web/            (前端)');
console.log('   ├── data/           (数据库，运行后生成)');
console.log('   ├── start.bat       (双击启动)');
console.log('   └── README.md       (使用说明)');
