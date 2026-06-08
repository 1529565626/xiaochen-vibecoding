import { ref, reactive } from 'vue';
import { api } from './api.js';

export function useChunkedUpload() {
  const tasks = reactive({});

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return v.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
  }

  function formatSpeed(bytesPerSec) {
    return formatSize(bytesPerSec) + '/s';
  }

  async function uploadFile(file, targetPath = '', root = 'download') {
    const taskId = `${Date.now()}-${file.name}`;
    const task = reactive({
      id: taskId,
      filename: file.name,
      totalSize: file.size,
      uploadedSize: 0,
      progress: 0,
      speed: 0,
      status: 'preparing', // preparing | uploading | merging | done | failed
      error: null
    });
    tasks[taskId] = task;

    try {
      // 1. 初始化上传
      task.status = 'preparing';
      const initRes = await api.initUpload(file.name, file.size, targetPath, root);
      const { uploadId, chunkSize, chunkCount } = initRes;

      // 2. 查看已上传分片（断点续传）
      let uploadedChunks = [];
      try {
        const statusRes = await api.getUploadStatus(uploadId);
        uploadedChunks = statusRes.chunks || [];
      } catch (e) { /* 忽略 */ }

      const uploadedSet = new Set(uploadedChunks);
      task.uploadedSize = uploadedSet.size * chunkSize;
      task.progress = Math.round((task.uploadedSize / file.size) * 100);
      task.status = 'uploading';

      // 3. 上传未完成的分片
      let lastTime = Date.now();
      let lastSize = task.uploadedSize;

      for (let i = 0; i < chunkCount; i++) {
        if (uploadedSet.has(i)) continue;

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const blob = file.slice(start, end);

        await api.uploadChunk(uploadId, i, blob);

        task.uploadedSize += (end - start);
        task.progress = Math.round((task.uploadedSize / file.size) * 100);

        // 计算速度
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 1) {
          task.speed = (task.uploadedSize - lastSize) / elapsed;
          lastTime = now;
          lastSize = task.uploadedSize;
        }
      }

      // 4. 通知合并
      task.status = 'merging';
      await api.completeUpload(uploadId);
      task.status = 'done';
      task.progress = 100;
    } catch (err) {
      task.status = 'failed';
      task.error = err.message;
    }

    return task;
  }

  return { tasks, uploadFile, formatSize, formatSpeed };
}
