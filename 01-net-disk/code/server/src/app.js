import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import filesRoutes from './routes/files.js';
import uploadRoutes from './routes/upload.js';
import downloadRoutes from './routes/download.js';
import adminRoutes from './routes/admin.js';

function findWebDir() {
  // 候选路径：release 模式（web/ 与 server 同级） → dev 模式（web/dist/ 在项目内）
  const serverDir = typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), 'web'),
    resolve(serverDir, '../../web/dist'),
    resolve(serverDir, '../web/dist')
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'index.html'))) return p;
  }
  return null;
}

export default async function buildApp(config) {
  const app = Fastify({
    logger: false,
    bodyLimit: config.upload.chunkSize + 1024 * 1024,
    routerOptions: { maxParamLength: 500 }
  });

  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: config.upload.chunkSize + 1024 * 1024,
      files: 1
    }
  });

  const webDir = findWebDir();
  if (webDir) {
    await app.register(fastifyStatic, { root: webDir, prefix: '/' });
  }

  await app.register(filesRoutes, { config });
  await app.register(uploadRoutes, { config });
  await app.register(downloadRoutes, { config });
  await app.register(adminRoutes, { config, prefix: '' });

  if (webDir) {
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
