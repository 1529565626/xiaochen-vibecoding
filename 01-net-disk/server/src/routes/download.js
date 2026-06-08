import { existsSync, statSync, createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { validatePath } from '../middleware/security.js';

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.pdf': 'application/pdf',
  '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain', '.md': 'text/markdown',
};

function getMimeType(filename) {
  const ext = extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export default async function downloadRoutes(fastify, opts) {
  const { downloadDir, uploadDir } = opts.config.storage;
  const highWaterMark = opts.config.download.streamHighWaterMark;

  // GET /api/download?path=/dir/file.mp4&root=download|upload
  fastify.get('/api/download', async (request, reply) => {
    try {
      const requestPath = request.query.path;
      if (!requestPath) {
        return reply.code(400).send({ error: '缺少 path 参数' });
      }

      const root = request.query.root || 'download';
      const rootDir = root === 'upload' ? uploadDir : downloadDir;
      const safePath = validatePath(requestPath, rootDir);

      if (!existsSync(safePath)) {
        return reply.code(404).send({ error: '文件不存在' });
      }

      const stats = statSync(safePath);
      if (stats.isDirectory()) {
        return reply.code(400).send({ error: '不能下载目录' });
      }

      const filename = requestPath.split('/').pop();
      const mimeType = getMimeType(filename);

      reply.header('Content-Type', mimeType);
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      reply.header('Content-Length', stats.size);
      reply.header('Accept-Ranges', 'bytes');

      const stream = createReadStream(safePath, { highWaterMark });
      return reply.send(stream);
    } catch (err) {
      if (!reply.sent) {
        reply.code(err.statusCode || 500).send({ error: err.message });
      }
    }
  });
}
