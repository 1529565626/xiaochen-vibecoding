import { resolve, normalize } from 'node:path';

function validatePath(requestPath, allowedRoots) {
  if (!requestPath || typeof requestPath !== 'string') {
    throw { statusCode: 400, message: '缺少 path 参数' };
  }

  // 标准化路径并检测目录穿越
  const normalized = normalize(requestPath).replace(/\\/g, '/');

  if (normalized.includes('..')) {
    throw { statusCode: 403, message: '不允许的路径操作' };
  }

  const roots = Array.isArray(allowedRoots) ? allowedRoots : [allowedRoots];
  const resolvedPaths = roots.map(root => resolve(root)).map(p => p.replace(/\\/g, '/'));

  for (const rootPath of resolvedPaths) {
    const fullPath = resolve(rootPath, '.' + normalized).replace(/\\/g, '/');
    if (fullPath.startsWith(rootPath)) {
      return fullPath;
    }
  }

  throw { statusCode: 403, message: '路径不在允许范围内' };
}

function pathGuard(allowedRoots) {
  return async function (request, reply) {
    try {
      const requestPath = request.query.path || request.body?.path || '';
      const safePath = validatePath(requestPath, allowedRoots);
      request.safePath = safePath;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  };
}

export { validatePath, pathGuard };
