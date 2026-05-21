const BASE = '';

async function request(url, options = {}) {
  const headers = { ...options.headers };
  // 仅当有 body 时设置 JSON Content-Type，避免 GET 请求触发 Fastify 空 body 校验
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(BASE + url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export const api = {
  // 文件浏览
  listFiles(dirPath = '/', root = 'download') {
    return request(`/api/files?path=${encodeURIComponent(dirPath)}&root=${root}`);
  },
  getFileInfo(filePath, root = 'download') {
    return request(`/api/files/info?path=${encodeURIComponent(filePath)}&root=${root}`);
  },

  // 上传
  initUpload(filename, totalSize, targetPath = '', root = 'download') {
    return request('/api/upload/init', {
      method: 'POST',
      body: JSON.stringify({ filename, totalSize, targetPath, root })
    });
  },
  async uploadChunk(uploadId, chunkIndex, blob) {
    const form = new FormData();
    form.append('uploadId', uploadId);
    form.append('chunkIndex', String(chunkIndex));
    form.append('file', blob);
    const res = await fetch(`${BASE}/api/upload/chunk`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `分片上传失败 (${res.status})`);
    }
    return data;
  },
  getUploadStatus(uploadId) {
    return request(`/api/upload/status/${uploadId}`);
  },
  completeUpload(uploadId) {
    return request(`/api/upload/complete/${uploadId}`, { method: 'POST' });
  },
  getUploadTasks() {
    return request('/api/upload/tasks');
  },

  // 下载
  getDownloadUrl(filePath, root = 'download') {
    return `${BASE}/api/download?path=${encodeURIComponent(filePath)}&root=${root}`;
  },

  // 管理端
  createFolder(dirPath, name, root = 'download') {
    return request('/api/admin/folder', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath, name, root })
    });
  },
  renameFolder(dirPath, oldName, newName, root = 'download') {
    return request('/api/admin/folder', {
      method: 'PUT',
      body: JSON.stringify({ path: dirPath, oldName, newName, root })
    });
  },
  deleteFolder(dirPath, name, root = 'download') {
    return request('/api/admin/folder', {
      method: 'DELETE',
      body: JSON.stringify({ path: dirPath, name, root })
    });
  },
  deleteFile(filePath, root = 'download') {
    return request('/api/admin/file', {
      method: 'DELETE',
      body: JSON.stringify({ path: filePath, root })
    });
  },
  getConfig() {
    return request('/api/admin/config');
  },
  updateConfig(config) {
    return request('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },
  getStatus() {
    return request('/api/admin/status');
  },
  getQrcode() {
    return request('/api/admin/qrcode');
  },
  openFolder(dirPath = '/', root = 'download') {
    return request('/api/admin/open-folder', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath, root })
    });
  }
};
