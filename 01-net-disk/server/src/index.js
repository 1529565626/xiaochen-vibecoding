import { loadConfig } from './config.js';
import { initDb, closeDb } from './db.js';
import { getLanIP } from './utils/network.js';
import { generateQrSvg } from './utils/qrcode.js';
import buildApp from './app.js';
import { exec } from 'node:child_process';

async function start() {
  const config = loadConfig();

  // 动态导入 fs / path（兼容 CJS 打包）
  const { existsSync, rmSync, writeFileSync, mkdirSync, unlinkSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');

  // 初始化数据库
  await initDb();

  // 启动时清理残留的临时分片
  const chunksDir = resolve(config.storage.tempDir, 'chunks');
  if (existsSync(chunksDir)) {
    rmSync(chunksDir, { recursive: true, force: true });
    console.log('[startup] 已清理残留临时分片');
  }

  const app = await buildApp(config);

  try {
    await app.listen({ port: config.server.port, host: config.server.host });
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`端口 ${config.server.port} 已被占用，请更换端口`);
      process.exit(1);
    }
    throw err;
  }

  // 写入 PID 文件，供 stop.bat 使用
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const pidPath = join(dataDir, 'server.pid');
  writeFileSync(pidPath, String(process.pid));

  const ip = getLanIP();
  const url = `http://${ip}:${config.server.port}`;
  const localUrl = `http://127.0.0.1:${config.server.port}`;

  console.log('═══════════════════════════════════════');
  console.log('  my-net-disk 已启动');
  console.log(`  本机访问: ${localUrl}`);
  console.log(`  局域网:   ${url}`);
  console.log('═══════════════════════════════════════');
  console.log('  扫描下方二维码从手机访问：');

  const qrSvg = await generateQrSvg(url, {
    width: config.qrcode.size,
    color: config.qrcode.color,
    bgColor: config.qrcode.bgColor
  });
  console.log(qrSvg);
  console.log('  按 Ctrl+C 退出服务');
  console.log('═══════════════════════════════════════');

  // 自动打开浏览器
  if (config.server.autoOpen) {
    const platform = process.platform;
    let cmd;
    if (platform === 'win32') {
      cmd = `start ${localUrl}/#/admin`;
    } else if (platform === 'darwin') {
      cmd = `open ${localUrl}/#/admin`;
    } else {
      cmd = `xdg-open ${localUrl}/#/admin`;
    }
    exec(cmd);
  }

  // 优雅退出
  const shutdown = () => {
    console.log('\n正在关闭服务...');
    app.close().then(() => {
      closeDb();
      try { if (existsSync(pidPath)) unlinkSync(pidPath); } catch {}
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
