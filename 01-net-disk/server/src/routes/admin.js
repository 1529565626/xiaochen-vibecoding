import { validatePath } from '../middleware/security.js';
import { createFolder, renameFolder, deleteFolder, deleteFile, getDiskInfo } from '../services/fileManager.js';
import { generateQrSvg } from '../utils/qrcode.js';
import { getLanIP } from '../utils/network.js';
import { saveUserConfig } from '../config.js';
import { exec } from 'node:child_process';

export default async function adminRoutes(fastify, opts) {
  const { downloadDir, uploadDir } = opts.config.storage;
  const adminConfig = opts.config.admin;

  function getRoot(root) {
    return root === 'upload' ? uploadDir : downloadDir;
  }

  // 管理端 API 仅允许本机访问（除非配置允许远程）
  fastify.addHook('onRequest', async (request, reply) => {
    if (!adminConfig.allowRemote) {
      const ip = request.ip;
      if (ip !== '127.0.0.1' && ip !== '::1' && ip !== 'localhost' && ip !== '::ffff:127.0.0.1') {
        return reply.code(403).send({ error: '管理端仅允许本机访问' });
      }
    }
  });

  // POST /api/admin/folder
  fastify.post('/api/admin/folder', async (request, reply) => {
    try {
      const { path: dirPath, name, root } = request.body;
      if (!name) {
        return reply.code(400).send({ error: '缺少文件夹名称' });
      }
      const rootDir = getRoot(root);
      const safePath = validatePath(dirPath || '/', rootDir);
      const result = createFolder(safePath, name);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // PUT /api/admin/folder
  fastify.put('/api/admin/folder', async (request, reply) => {
    try {
      const { path: dirPath, oldName, newName, root } = request.body;
      if (!oldName || !newName) {
        return reply.code(400).send({ error: '缺少 oldName 或 newName' });
      }
      const rootDir = getRoot(root);
      const safePath = validatePath(dirPath || '/', rootDir);
      const result = renameFolder(safePath, oldName, newName);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // DELETE /api/admin/folder
  fastify.delete('/api/admin/folder', async (request, reply) => {
    try {
      const { path: dirPath, name, root } = request.body;
      if (!name) {
        return reply.code(400).send({ error: '缺少文件夹名称' });
      }
      const rootDir = getRoot(root);
      const safePath = validatePath(dirPath || '/', rootDir);
      const result = deleteFolder(safePath, name);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // DELETE /api/admin/file
  fastify.delete('/api/admin/file', async (request, reply) => {
    try {
      const { path: filePath, root } = request.body;
      if (!filePath) {
        return reply.code(400).send({ error: '缺少文件路径' });
      }
      const rootDir = getRoot(root);
      const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
      const parts = normalized.split('/');
      const filename = parts.pop();
      const subDir = parts.length > 0 ? '/' + parts.join('/') : '/';
      const safePath = validatePath(subDir, rootDir);
      const result = deleteFile(safePath, filename);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // GET /api/admin/config
  fastify.get('/api/admin/config', async () => {
    return {
      config: {
        server: opts.config.server,
        storage: opts.config.storage,
        upload: opts.config.upload,
        download: opts.config.download,
        admin: opts.config.admin,
        access: opts.config.access,
        qrcode: opts.config.qrcode
      }
    };
  });

  // PUT /api/admin/config
  fastify.put('/api/admin/config', async (request, reply) => {
    try {
      const updates = request.body;
      saveUserConfig(updates);
      // 更新内存中的配置
      Object.assign(opts.config, updates);
      return { status: 'ok', message: '配置已保存，重启服务后生效' };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET /api/admin/status
  fastify.get('/api/admin/status', async () => {
    const disk = getDiskInfo(downloadDir);
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      downloadDir: downloadDir,
      uploadDir: opts.config.storage.uploadDir,
      tempDir: opts.config.storage.tempDir,
      disk
    };
  });

  // POST /api/admin/open-folder  — 在资源管理器中打开目录
  fastify.post('/api/admin/open-folder', async (request, reply) => {
    try {
      const targetPath = request.body?.path || '/';
      const rootDir = getRoot(request.body?.root);
      const safePath = validatePath(targetPath, rootDir);

      const platform = process.platform;
      let cmd;
      if (platform === 'win32') {
        const winPath = safePath.replace(/\//g, '\\');
        cmd = `explorer "${winPath}"`;
      } else if (platform === 'darwin') {
        cmd = `open "${safePath}"`;
      } else {
        cmd = `xdg-open "${safePath}"`;
      }

      exec(cmd, (err) => {
        if (err) {
          return reply.code(500).send({ error: '打开目录失败: ' + err.message });
        }
      });

      return { status: 'ok', path: safePath };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // GET /api/admin/qrcode
  fastify.get('/api/admin/qrcode', async () => {
    const ip = getLanIP();
    const port = opts.config.server.port;
    const url = `http://${ip}:${port}`;
    const svg = await generateQrSvg(url, {
      width: opts.config.qrcode.size,
      color: opts.config.qrcode.color,
      bgColor: opts.config.qrcode.bgColor
    });
    return { url, svg };
  });
}
