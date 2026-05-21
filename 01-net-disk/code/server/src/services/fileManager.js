import { readdirSync, statSync, mkdirSync, renameSync, rmdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

function listDirectory(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const items = entries.map(entry => {
    const fullPath = resolve(dirPath, entry.name);
    const stats = statSync(fullPath);
    return {
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString()
    };
  });
  // 目录在前，文件在后，各自按名称排序
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh');
  });
  return items;
}

function getFileInfo(dirPath, filename) {
  const fullPath = resolve(dirPath, filename);
  if (!existsSync(fullPath)) {
    throw { statusCode: 404, message: '文件不存在' };
  }
  const stats = statSync(fullPath);
  return {
    name: filename,
    type: stats.isDirectory() ? 'directory' : 'file',
    size: stats.size,
    modifiedAt: stats.mtime.toISOString()
  };
}

function createFolder(dirPath, folderName) {
  const safeName = folderName.replace(/[<>:"|?*\\/]/g, '_').trim();
  if (!safeName) {
    throw { statusCode: 400, message: '文件夹名称无效' };
  }
  const fullPath = resolve(dirPath, safeName);
  if (existsSync(fullPath)) {
    throw { statusCode: 409, message: '文件夹已存在' };
  }
  mkdirSync(fullPath);
  return { name: safeName, path: fullPath };
}

function renameFolder(dirPath, oldName, newName) {
  const safeName = newName.replace(/[<>:"|?*\\/]/g, '_').trim();
  if (!safeName) {
    throw { statusCode: 400, message: '文件夹名称无效' };
  }
  const oldPath = resolve(dirPath, oldName);
  const newPath = resolve(dirPath, safeName);
  if (!existsSync(oldPath)) {
    throw { statusCode: 404, message: '文件夹不存在' };
  }
  if (existsSync(newPath)) {
    throw { statusCode: 409, message: '目标名称已存在' };
  }
  renameSync(oldPath, newPath);
  return { name: safeName, path: newPath };
}

function deleteFolder(dirPath, folderName) {
  const fullPath = resolve(dirPath, folderName);
  if (!existsSync(fullPath)) {
    throw { statusCode: 404, message: '文件夹不存在' };
  }
  const stats = statSync(fullPath);
  if (!stats.isDirectory()) {
    throw { statusCode: 400, message: '不是文件夹' };
  }
  // 检查是否为空目录
  const entries = readdirSync(fullPath);
  if (entries.length > 0) {
    throw { statusCode: 400, message: '文件夹不为空，请先删除内部文件' };
  }
  rmdirSync(fullPath);
  return { deleted: true };
}

function deleteFile(dirPath, filename) {
  const fullPath = resolve(dirPath, filename);
  if (!existsSync(fullPath)) {
    throw { statusCode: 404, message: '文件不存在' };
  }
  const stats = statSync(fullPath);
  if (stats.isDirectory()) {
    throw { statusCode: 400, message: '请使用文件夹删除接口' };
  }
  unlinkSync(fullPath);
  return { deleted: true };
}

function getDiskInfo(dirPath) {
  // Node.js 没有内置磁盘空间查询，返回目录基本信息
  const stats = statSync(dirPath);
  return {
    path: dirPath,
    createdAt: stats.birthtime?.toISOString() || null
  };
}

export { listDirectory, getFileInfo, createFolder, renameFolder, deleteFolder, deleteFile, getDiskInfo };
