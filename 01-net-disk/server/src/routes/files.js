import { validatePath } from '../middleware/security.js';
import { listDirectory, getFileInfo } from '../services/fileManager.js';

export default async function filesRoutes(fastify, opts) {
  const { downloadDir, uploadDir } = opts.config.storage;

  function getRootDir(root) {
    return root === 'upload' ? uploadDir : downloadDir;
  }

  // GET /api/files?path=/subdir&root=download|upload
  fastify.get('/api/files', async (request, reply) => {
    try {
      const requestPath = request.query.path || '/';
      const root = request.query.root || 'download';
      const rootDir = getRootDir(root);
      const safePath = validatePath(requestPath, rootDir);
      const items = listDirectory(safePath);
      return { path: requestPath, root, items };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // GET /api/files/info?path=/subdir/file.mp4&root=download|upload
  fastify.get('/api/files/info', async (request, reply) => {
    try {
      const requestPath = request.query.path || '';
      const root = request.query.root || 'download';
      const rootDir = getRootDir(root);
      const normalized = requestPath.replace(/\\/g, '/').replace(/^\/+/, '');
      const parts = normalized.split('/');
      const filename = parts.pop();
      const subDir = parts.length > 0 ? '/' + parts.join('/') : '/';
      const targetDir = validatePath(subDir, rootDir);
      const info = getFileInfo(targetDir, filename);
      return info;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}
