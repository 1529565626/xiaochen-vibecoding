import { existsSync, mkdirSync, createWriteStream, createReadStream, rmSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { dbRun, dbGet, dbAll } from '../db.js';
import { validatePath } from '../middleware/security.js';

export default async function uploadRoutes(fastify, opts) {
  const { tempDir, downloadDir, uploadDir } = opts.config.storage;
  const uploadConfig = opts.config.upload;

  // POST /api/upload/init
  fastify.post('/api/upload/init', async (request, reply) => {
    try {
      const { filename, totalSize, targetPath, root } = request.body;

      if (!filename || !totalSize) {
        return reply.code(400).send({ error: '缺少 filename 或 totalSize' });
      }
      if (totalSize > uploadConfig.maxFileSize) {
        return reply.code(413).send({ error: '文件大小超过限制' });
      }

      const safeName = filename.replace(/[<>:"|?*]/g, '_');
      const defaultDir = root === 'upload' ? uploadDir : downloadDir;
      const destPath = targetPath
        ? validatePath(targetPath, defaultDir)
        : defaultDir;

      const uploadId = randomUUID();
      const chunkSize = uploadConfig.chunkSize;
      const chunkCount = Math.ceil(totalSize / chunkSize);

      const chunksDir = resolve(tempDir, 'chunks', uploadId);
      mkdirSync(chunksDir, { recursive: true });

      dbRun(
        `INSERT INTO uploads (id, filename, target_path, total_size, chunk_size, chunk_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uploadId, safeName, destPath, totalSize, chunkSize, chunkCount]
      );

      return { uploadId, chunkSize, chunkCount };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // POST /api/upload/chunk
  fastify.post('/api/upload/chunk', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: '未收到文件数据' });
      }

      const uploadId = data.fields?.uploadId?.value;
      const chunkIndex = data.fields?.chunkIndex?.value;

      if (!uploadId || chunkIndex === undefined) {
        return reply.code(400).send({ error: '缺少 uploadId 或 chunkIndex' });
      }

      const upload = dbGet('SELECT * FROM uploads WHERE id = ?', [uploadId]);
      if (!upload) {
        return reply.code(404).send({ error: '上传任务不存在' });
      }

      const chunkPath = resolve(tempDir, 'chunks', uploadId, String(chunkIndex));
      await pipeline(data.file, createWriteStream(chunkPath));

      return { chunkIndex: parseInt(chunkIndex), status: 'ok' };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // GET /api/upload/status/:uploadId
  fastify.get('/api/upload/status/:uploadId', async (request, reply) => {
    try {
      const { uploadId } = request.params;
      const upload = dbGet('SELECT * FROM uploads WHERE id = ?', [uploadId]);
      if (!upload) {
        return reply.code(404).send({ error: '上传任务不存在' });
      }

      const chunksDir = resolve(tempDir, 'chunks', uploadId);
      if (!existsSync(chunksDir)) {
        return { uploadId, status: upload.status, chunks: [] };
      }

      const files = readdirSync(chunksDir);
      const chunks = files.map(f => parseInt(f)).filter(n => !isNaN(n)).sort((a, b) => a - b);

      return { uploadId, status: upload.status, chunks, totalChunks: upload.chunk_count };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // POST /api/upload/complete/:uploadId
  fastify.post('/api/upload/complete/:uploadId', async (request, reply) => {
    try {
      const { uploadId } = request.params;
      const upload = dbGet('SELECT * FROM uploads WHERE id = ?', [uploadId]);
      if (!upload) {
        return reply.code(404).send({ error: '上传任务不存在' });
      }
      if (upload.status === 'done') {
        return reply.code(400).send({ error: '文件已合并完成' });
      }

      const chunksDir = resolve(tempDir, 'chunks', uploadId);

      // 验证所有分片存在
      for (let i = 0; i < upload.chunk_count; i++) {
        const chunkPath = resolve(chunksDir, String(i));
        if (!existsSync(chunkPath)) {
          dbRun("UPDATE uploads SET status = 'failed', updated_at = datetime('now') WHERE id = ?", [uploadId]);
          return reply.code(400).send({ error: `缺少分片 ${i}，请重新上传` });
        }
      }

      // 开始合并
      dbRun("UPDATE uploads SET status = 'merging', updated_at = datetime('now') WHERE id = ?", [uploadId]);

      const destPath = resolve(upload.target_path, upload.filename);
      const writeStream = createWriteStream(destPath);

      for (let i = 0; i < upload.chunk_count; i++) {
        const chunkPath = resolve(chunksDir, String(i));
        const readStream = createReadStream(chunkPath);
        await new Promise((resolve, reject) => {
          readStream.pipe(writeStream, { end: false });
          readStream.on('end', resolve);
          readStream.on('error', reject);
          writeStream.on('error', reject);
        });
      }

      await new Promise((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // 清理临时文件
      if (uploadConfig.cleanupTemp) {
        rmSync(chunksDir, { recursive: true, force: true });
      }

      dbRun("UPDATE uploads SET status = 'done', updated_at = datetime('now') WHERE id = ?", [uploadId]);

      return { uploadId, status: 'done', filename: upload.filename, path: destPath };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // GET /api/upload/tasks  — 获取所有上传任务状态
  fastify.get('/api/upload/tasks', async (request, reply) => {
    try {
      const tasks = dbAll('SELECT * FROM uploads ORDER BY created_at DESC LIMIT 50');
      return { tasks };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
}
