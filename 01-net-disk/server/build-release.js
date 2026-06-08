// 打包脚本：用 esbuild 打包源码 → CJS bundle + 复制依赖到 release
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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
console.log('[1/5] 打包源码...');
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
console.log('[2/5] 复制依赖...');
const nmSrc = resolve(__dirname, 'node_modules');
const nmDest = resolve(releaseDir, 'node_modules');
cpSync(nmSrc, nmDest, { recursive: true });

// 3. 复制配置文件
console.log('[3/5] 复制资源...');
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

// 4. 启动/停止脚本和说明
console.log('[4/5] 创建启动/停止脚本...');

const port = 3000;
const adminUrl = `http://127.0.0.1:${port}/#/admin`;

const startBat = `@echo off
title my-net-disk
setlocal enabledelayedexpansion

set ADMIN_URL=${adminUrl}
set PID_FILE=%~dp0data\\server.pid

if not exist "%PID_FILE%" goto :launch

set /p SAVED_PID=<"%PID_FILE%"
tasklist /FI "PID eq !SAVED_PID!" 2>nul | find "!SAVED_PID!" >nul
if errorlevel 1 (
    echo [my-net-disk] Stale PID file found, restarting...
    del "%PID_FILE%" 2>nul
    goto :launch
)

echo [my-net-disk] Already running (PID: !SAVED_PID!)
start "" "%ADMIN_URL%"
timeout /t 2 >nul
exit

:launch
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    timeout /t 3 >nul
    exit
)

powershell -Command "Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%~dp0'"
echo [my-net-disk] Starting...
timeout /t 2 >nul

start "" "%ADMIN_URL%"
echo [my-net-disk] Started. To stop, double-click stop.bat
timeout /t 2 >nul
`;

const stopBat = `@echo off
title my-net-disk - stop

echo [my-net-disk] Looking for service on port 3000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /C:":3000 " ^| findstr "LISTENING"') do (
    echo [my-net-disk] Stopping PID %%a ...
    taskkill /PID %%a /F
    goto :done
)

echo [my-net-disk] No running service found
goto :cleanup

:done
echo [my-net-disk] Stopped

:cleanup
del "%~dp0data\\server.pid" 2>nul
timeout /t 2 >nul
`;

writeFileSync(resolve(releaseDir, 'start.bat'), startBat);
writeFileSync(resolve(releaseDir, 'stop.bat'), stopBat);

// README
const readme = `# my-net-disk · 局域网文件管理服务

## 使用方法

1. 确保电脑已安装 Node.js（如未安装，先去 https://nodejs.org 下载 LTS 版本）
2. 双击 **start.bat** 启动服务
3. 浏览器自动打开管理端页面
4. 右下角二维码，手机扫码即可访问客户端
5. 双击 **stop.bat** 关闭服务

## 管理端

- 仪表盘：${adminUrl}
- 文件管理：http://127.0.0.1:${port}/#/admin/files
- 系统配置：http://127.0.0.1:${port}/#/admin/settings

## 文件夹说明

- config/default.json  — 默认配置文件
- web/                — 前端页面
- data/               — 数据库（自动生成）

## 注意事项

- 管理端仅限本机访问（安全设计）
- 客户端可在局域网任意设备访问
- 关闭服务请运行 stop.bat，直接关窗口可能端口未释放
`;
writeFileSync(resolve(releaseDir, 'README.md'), readme);

// 5. 打包为 zip
console.log('[5/5] 打包 zip...');
const zipName = 'my-net-disk-release.zip';
const zipPath = resolve(root, zipName);
if (existsSync(zipPath)) unlinkSync(zipPath);

if (process.platform === 'win32') {
  execSync(`powershell -Command "Compress-Archive -Path '${releaseDir}\\*' -DestinationPath '${zipPath}'"`, { stdio: 'inherit' });
} else {
  execSync(`cd "${releaseDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}
console.log(`  完成 -> ${zipName}`);

console.log('\n✅ Release 已构建到 release/ 目录');
console.log('   结构:');
console.log('   release/');
console.log('   ├── server.js       (打包后的服务端)');
console.log('   ├── node_modules/   (运行时依赖)');
console.log('   ├── config/         (配置文件)');
console.log('   ├── web/            (前端)');
console.log('   ├── data/           (数据库，运行后生成)');
console.log('   ├── start.bat       (双击启动)');
console.log('   ├── stop.bat        (双击停止)');
console.log('   └── README.md       (使用说明)');
