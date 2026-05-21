var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/config.js
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_url = require("node:url");
var import_meta = {};
function getBaseDir() {
  return typeof __dirname !== "undefined" ? __dirname : (0, import_node_path.dirname)((0, import_node_url.fileURLToPath)(import_meta.url));
}
function findConfigPath(filename) {
  const candidates = [
    (0, import_node_path.join)(process.cwd(), "config", filename),
    // release: ./config/
    (0, import_node_path.resolve)(getBaseDir(), "../config", filename),
    // dev: server/src/../config/
    (0, import_node_path.resolve)(getBaseDir(), "../../config", filename)
    // alternative
  ];
  for (const p of candidates) {
    if ((0, import_node_fs.existsSync)(p)) return p;
  }
  return (0, import_node_path.join)(process.cwd(), "config", filename);
}
function loadConfig() {
  const configPath = findConfigPath("default.json");
  const raw = (0, import_node_fs.readFileSync)(configPath, "utf-8");
  const config = JSON.parse(raw);
  const userConfigPath = findConfigPath("user.json");
  if ((0, import_node_fs.existsSync)(userConfigPath)) {
    const userRaw = (0, import_node_fs.readFileSync)(userConfigPath, "utf-8");
    const userConfig = JSON.parse(userRaw);
    deepMerge(config, userConfig);
  }
  for (const key of ["downloadDir", "uploadDir", "tempDir"]) {
    const dirPath = config.storage[key];
    if (!(0, import_node_fs.existsSync)(dirPath)) {
      (0, import_node_fs.mkdirSync)(dirPath, { recursive: true });
    }
  }
  return config;
}
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
function saveUserConfig(updates) {
  const userConfigPath = findConfigPath("user.json");
  let existing = {};
  if ((0, import_node_fs.existsSync)(userConfigPath)) {
    existing = JSON.parse((0, import_node_fs.readFileSync)(userConfigPath, "utf-8"));
  }
  deepMerge(existing, updates);
  (0, import_node_fs.writeFileSync)(userConfigPath, JSON.stringify(existing, null, 2), "utf-8");
}

// src/db.js
var import_sql = __toESM(require("sql.js"), 1);
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
function getDataDir() {
  const candidates = [
    (0, import_node_path2.join)(process.cwd(), "data"),
    (0, import_node_path2.resolve)(process.cwd(), "../data")
  ];
  for (const p of candidates) {
    return p;
  }
  return (0, import_node_path2.join)(process.cwd(), "data");
}
var DB_PATH = (0, import_node_path2.join)(getDataDir(), "uploads.db");
var db;
async function initDb() {
  const SQL = await (0, import_sql.default)();
  const dataDir = getDataDir();
  if (!(0, import_node_fs2.existsSync)(dataDir)) {
    (0, import_node_fs2.mkdirSync)(dataDir, { recursive: true });
  }
  if ((0, import_node_fs2.existsSync)(DB_PATH)) {
    const buffer = (0, import_node_fs2.readFileSync)(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      target_path TEXT NOT NULL,
      total_size  INTEGER NOT NULL,
      chunk_size  INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      status      TEXT DEFAULT 'uploading',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  saveDb();
  return db;
}
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  (0, import_node_fs2.writeFileSync)(DB_PATH, buffer);
}
function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
}
function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}
function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

// src/utils/network.js
var import_node_os = require("node:os");
function getLanIP() {
  const interfaces = (0, import_node_os.networkInterfaces)();
  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === "IPv4" && !net.internal) {
        if (net.address.startsWith("192.168.")) {
          return net.address;
        }
      }
    }
  }
  for (const [, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

// src/utils/qrcode.js
var import_qrcode = __toESM(require("qrcode"), 1);
async function generateQrSvg(url, options = {}) {
  const opts = {
    type: "svg",
    width: options.width || 200,
    color: {
      dark: options.color || "#000000",
      light: options.bgColor || "#FFFFFF"
    },
    margin: 2
  };
  return import_qrcode.default.toString(url, opts);
}

// src/app.js
var import_fastify = __toESM(require("fastify"), 1);
var import_static = __toESM(require("@fastify/static"), 1);
var import_multipart = __toESM(require("@fastify/multipart"), 1);
var import_cors = __toESM(require("@fastify/cors"), 1);
var import_node_fs6 = require("node:fs");
var import_node_path7 = require("node:path");
var import_node_url2 = require("node:url");

// src/middleware/security.js
var import_node_path3 = require("node:path");
function validatePath(requestPath, allowedRoots) {
  if (!requestPath || typeof requestPath !== "string") {
    throw { statusCode: 400, message: "\u7F3A\u5C11 path \u53C2\u6570" };
  }
  const normalized = (0, import_node_path3.normalize)(requestPath).replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw { statusCode: 403, message: "\u4E0D\u5141\u8BB8\u7684\u8DEF\u5F84\u64CD\u4F5C" };
  }
  const roots = Array.isArray(allowedRoots) ? allowedRoots : [allowedRoots];
  const resolvedPaths = roots.map((root) => (0, import_node_path3.resolve)(root)).map((p) => p.replace(/\\/g, "/"));
  for (const rootPath of resolvedPaths) {
    const fullPath = (0, import_node_path3.resolve)(rootPath, "." + normalized).replace(/\\/g, "/");
    if (fullPath.startsWith(rootPath)) {
      return fullPath;
    }
  }
  throw { statusCode: 403, message: "\u8DEF\u5F84\u4E0D\u5728\u5141\u8BB8\u8303\u56F4\u5185" };
}

// src/services/fileManager.js
var import_node_fs3 = require("node:fs");
var import_node_path4 = require("node:path");
function listDirectory(dirPath) {
  const entries = (0, import_node_fs3.readdirSync)(dirPath, { withFileTypes: true });
  const items = entries.map((entry) => {
    const fullPath = (0, import_node_path4.resolve)(dirPath, entry.name);
    const stats = (0, import_node_fs3.statSync)(fullPath);
    return {
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      size: stats.size,
      modifiedAt: stats.mtime.toISOString()
    };
  });
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh");
  });
  return items;
}
function getFileInfo(dirPath, filename) {
  const fullPath = (0, import_node_path4.resolve)(dirPath, filename);
  if (!(0, import_node_fs3.existsSync)(fullPath)) {
    throw { statusCode: 404, message: "\u6587\u4EF6\u4E0D\u5B58\u5728" };
  }
  const stats = (0, import_node_fs3.statSync)(fullPath);
  return {
    name: filename,
    type: stats.isDirectory() ? "directory" : "file",
    size: stats.size,
    modifiedAt: stats.mtime.toISOString()
  };
}
function createFolder(dirPath, folderName) {
  const safeName = folderName.replace(/[<>:"|?*\\/]/g, "_").trim();
  if (!safeName) {
    throw { statusCode: 400, message: "\u6587\u4EF6\u5939\u540D\u79F0\u65E0\u6548" };
  }
  const fullPath = (0, import_node_path4.resolve)(dirPath, safeName);
  if ((0, import_node_fs3.existsSync)(fullPath)) {
    throw { statusCode: 409, message: "\u6587\u4EF6\u5939\u5DF2\u5B58\u5728" };
  }
  (0, import_node_fs3.mkdirSync)(fullPath);
  return { name: safeName, path: fullPath };
}
function renameFolder(dirPath, oldName, newName) {
  const safeName = newName.replace(/[<>:"|?*\\/]/g, "_").trim();
  if (!safeName) {
    throw { statusCode: 400, message: "\u6587\u4EF6\u5939\u540D\u79F0\u65E0\u6548" };
  }
  const oldPath = (0, import_node_path4.resolve)(dirPath, oldName);
  const newPath = (0, import_node_path4.resolve)(dirPath, safeName);
  if (!(0, import_node_fs3.existsSync)(oldPath)) {
    throw { statusCode: 404, message: "\u6587\u4EF6\u5939\u4E0D\u5B58\u5728" };
  }
  if ((0, import_node_fs3.existsSync)(newPath)) {
    throw { statusCode: 409, message: "\u76EE\u6807\u540D\u79F0\u5DF2\u5B58\u5728" };
  }
  (0, import_node_fs3.renameSync)(oldPath, newPath);
  return { name: safeName, path: newPath };
}
function deleteFolder(dirPath, folderName) {
  const fullPath = (0, import_node_path4.resolve)(dirPath, folderName);
  if (!(0, import_node_fs3.existsSync)(fullPath)) {
    throw { statusCode: 404, message: "\u6587\u4EF6\u5939\u4E0D\u5B58\u5728" };
  }
  const stats = (0, import_node_fs3.statSync)(fullPath);
  if (!stats.isDirectory()) {
    throw { statusCode: 400, message: "\u4E0D\u662F\u6587\u4EF6\u5939" };
  }
  const entries = (0, import_node_fs3.readdirSync)(fullPath);
  if (entries.length > 0) {
    throw { statusCode: 400, message: "\u6587\u4EF6\u5939\u4E0D\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u5220\u9664\u5185\u90E8\u6587\u4EF6" };
  }
  (0, import_node_fs3.rmdirSync)(fullPath);
  return { deleted: true };
}
function deleteFile(dirPath, filename) {
  const fullPath = (0, import_node_path4.resolve)(dirPath, filename);
  if (!(0, import_node_fs3.existsSync)(fullPath)) {
    throw { statusCode: 404, message: "\u6587\u4EF6\u4E0D\u5B58\u5728" };
  }
  const stats = (0, import_node_fs3.statSync)(fullPath);
  if (stats.isDirectory()) {
    throw { statusCode: 400, message: "\u8BF7\u4F7F\u7528\u6587\u4EF6\u5939\u5220\u9664\u63A5\u53E3" };
  }
  (0, import_node_fs3.unlinkSync)(fullPath);
  return { deleted: true };
}
function getDiskInfo(dirPath) {
  const stats = (0, import_node_fs3.statSync)(dirPath);
  return {
    path: dirPath,
    createdAt: stats.birthtime?.toISOString() || null
  };
}

// src/routes/files.js
async function filesRoutes(fastify, opts) {
  const { downloadDir, uploadDir } = opts.config.storage;
  function getRootDir(root) {
    return root === "upload" ? uploadDir : downloadDir;
  }
  fastify.get("/api/files", async (request, reply) => {
    try {
      const requestPath = request.query.path || "/";
      const root = request.query.root || "download";
      const rootDir = getRootDir(root);
      const safePath = validatePath(requestPath, rootDir);
      const items = listDirectory(safePath);
      return { path: requestPath, root, items };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.get("/api/files/info", async (request, reply) => {
    try {
      const requestPath = request.query.path || "";
      const root = request.query.root || "download";
      const rootDir = getRootDir(root);
      const normalized = requestPath.replace(/\\/g, "/").replace(/^\/+/, "");
      const parts = normalized.split("/");
      const filename = parts.pop();
      const subDir = parts.length > 0 ? "/" + parts.join("/") : "/";
      const targetDir = validatePath(subDir, rootDir);
      const info = getFileInfo(targetDir, filename);
      return info;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}

// src/routes/upload.js
var import_node_fs4 = require("node:fs");
var import_node_path5 = require("node:path");
var import_node_crypto = require("node:crypto");
var import_promises = require("node:stream/promises");
async function uploadRoutes(fastify, opts) {
  const { tempDir, downloadDir, uploadDir } = opts.config.storage;
  const uploadConfig = opts.config.upload;
  fastify.post("/api/upload/init", async (request, reply) => {
    try {
      const { filename, totalSize, targetPath, root } = request.body;
      if (!filename || !totalSize) {
        return reply.code(400).send({ error: "\u7F3A\u5C11 filename \u6216 totalSize" });
      }
      if (totalSize > uploadConfig.maxFileSize) {
        return reply.code(413).send({ error: "\u6587\u4EF6\u5927\u5C0F\u8D85\u8FC7\u9650\u5236" });
      }
      const safeName = filename.replace(/[<>:"|?*]/g, "_");
      const defaultDir = root === "upload" ? uploadDir : downloadDir;
      const destPath = targetPath ? validatePath(targetPath, defaultDir) : defaultDir;
      const uploadId = (0, import_node_crypto.randomUUID)();
      const chunkSize = uploadConfig.chunkSize;
      const chunkCount = Math.ceil(totalSize / chunkSize);
      const chunksDir = (0, import_node_path5.resolve)(tempDir, "chunks", uploadId);
      (0, import_node_fs4.mkdirSync)(chunksDir, { recursive: true });
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
  fastify.post("/api/upload/chunk", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: "\u672A\u6536\u5230\u6587\u4EF6\u6570\u636E" });
      }
      const uploadId = data.fields?.uploadId?.value;
      const chunkIndex = data.fields?.chunkIndex?.value;
      if (!uploadId || chunkIndex === void 0) {
        return reply.code(400).send({ error: "\u7F3A\u5C11 uploadId \u6216 chunkIndex" });
      }
      const upload = dbGet("SELECT * FROM uploads WHERE id = ?", [uploadId]);
      if (!upload) {
        return reply.code(404).send({ error: "\u4E0A\u4F20\u4EFB\u52A1\u4E0D\u5B58\u5728" });
      }
      const chunkPath = (0, import_node_path5.resolve)(tempDir, "chunks", uploadId, String(chunkIndex));
      await (0, import_promises.pipeline)(data.file, (0, import_node_fs4.createWriteStream)(chunkPath));
      return { chunkIndex: parseInt(chunkIndex), status: "ok" };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.get("/api/upload/status/:uploadId", async (request, reply) => {
    try {
      const { uploadId } = request.params;
      const upload = dbGet("SELECT * FROM uploads WHERE id = ?", [uploadId]);
      if (!upload) {
        return reply.code(404).send({ error: "\u4E0A\u4F20\u4EFB\u52A1\u4E0D\u5B58\u5728" });
      }
      const chunksDir = (0, import_node_path5.resolve)(tempDir, "chunks", uploadId);
      if (!(0, import_node_fs4.existsSync)(chunksDir)) {
        return { uploadId, status: upload.status, chunks: [] };
      }
      const files = (0, import_node_fs4.readdirSync)(chunksDir);
      const chunks = files.map((f) => parseInt(f)).filter((n) => !isNaN(n)).sort((a, b) => a - b);
      return { uploadId, status: upload.status, chunks, totalChunks: upload.chunk_count };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.post("/api/upload/complete/:uploadId", async (request, reply) => {
    try {
      const { uploadId } = request.params;
      const upload = dbGet("SELECT * FROM uploads WHERE id = ?", [uploadId]);
      if (!upload) {
        return reply.code(404).send({ error: "\u4E0A\u4F20\u4EFB\u52A1\u4E0D\u5B58\u5728" });
      }
      if (upload.status === "done") {
        return reply.code(400).send({ error: "\u6587\u4EF6\u5DF2\u5408\u5E76\u5B8C\u6210" });
      }
      const chunksDir = (0, import_node_path5.resolve)(tempDir, "chunks", uploadId);
      for (let i = 0; i < upload.chunk_count; i++) {
        const chunkPath = (0, import_node_path5.resolve)(chunksDir, String(i));
        if (!(0, import_node_fs4.existsSync)(chunkPath)) {
          dbRun("UPDATE uploads SET status = 'failed', updated_at = datetime('now') WHERE id = ?", [uploadId]);
          return reply.code(400).send({ error: `\u7F3A\u5C11\u5206\u7247 ${i}\uFF0C\u8BF7\u91CD\u65B0\u4E0A\u4F20` });
        }
      }
      dbRun("UPDATE uploads SET status = 'merging', updated_at = datetime('now') WHERE id = ?", [uploadId]);
      const destPath = (0, import_node_path5.resolve)(upload.target_path, upload.filename);
      const writeStream = (0, import_node_fs4.createWriteStream)(destPath);
      for (let i = 0; i < upload.chunk_count; i++) {
        const chunkPath = (0, import_node_path5.resolve)(chunksDir, String(i));
        const readStream = (0, import_node_fs4.createReadStream)(chunkPath);
        await new Promise((resolve7, reject) => {
          readStream.pipe(writeStream, { end: false });
          readStream.on("end", resolve7);
          readStream.on("error", reject);
          writeStream.on("error", reject);
        });
      }
      await new Promise((resolve7, reject) => {
        writeStream.end();
        writeStream.on("finish", resolve7);
        writeStream.on("error", reject);
      });
      if (uploadConfig.cleanupTemp) {
        (0, import_node_fs4.rmSync)(chunksDir, { recursive: true, force: true });
      }
      dbRun("UPDATE uploads SET status = 'done', updated_at = datetime('now') WHERE id = ?", [uploadId]);
      return { uploadId, status: "done", filename: upload.filename, path: destPath };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.get("/api/upload/tasks", async (request, reply) => {
    try {
      const tasks = dbAll("SELECT * FROM uploads ORDER BY created_at DESC LIMIT 50");
      return { tasks };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
}

// src/routes/download.js
var import_node_fs5 = require("node:fs");
var import_node_path6 = require("node:path");
var MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".7z": "application/x-7z-compressed",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".md": "text/markdown"
};
function getMimeType(filename) {
  const ext = (0, import_node_path6.extname)(filename).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}
async function downloadRoutes(fastify, opts) {
  const { downloadDir, uploadDir } = opts.config.storage;
  const highWaterMark = opts.config.download.streamHighWaterMark;
  fastify.get("/api/download", async (request, reply) => {
    try {
      const requestPath = request.query.path;
      if (!requestPath) {
        return reply.code(400).send({ error: "\u7F3A\u5C11 path \u53C2\u6570" });
      }
      const root = request.query.root || "download";
      const rootDir = root === "upload" ? uploadDir : downloadDir;
      const safePath = validatePath(requestPath, rootDir);
      if (!(0, import_node_fs5.existsSync)(safePath)) {
        return reply.code(404).send({ error: "\u6587\u4EF6\u4E0D\u5B58\u5728" });
      }
      const stats = (0, import_node_fs5.statSync)(safePath);
      if (stats.isDirectory()) {
        return reply.code(400).send({ error: "\u4E0D\u80FD\u4E0B\u8F7D\u76EE\u5F55" });
      }
      const filename = requestPath.split("/").pop();
      const mimeType = getMimeType(filename);
      reply.header("Content-Type", mimeType);
      reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      reply.header("Content-Length", stats.size);
      reply.header("Accept-Ranges", "bytes");
      const stream = (0, import_node_fs5.createReadStream)(safePath, { highWaterMark });
      return reply.send(stream);
    } catch (err) {
      if (!reply.sent) {
        reply.code(err.statusCode || 500).send({ error: err.message });
      }
    }
  });
}

// src/routes/admin.js
var import_node_child_process = require("node:child_process");
async function adminRoutes(fastify, opts) {
  const { downloadDir, uploadDir } = opts.config.storage;
  const adminConfig = opts.config.admin;
  function getRoot(root) {
    return root === "upload" ? uploadDir : downloadDir;
  }
  fastify.addHook("onRequest", async (request, reply) => {
    if (!adminConfig.allowRemote) {
      const ip = request.ip;
      if (ip !== "127.0.0.1" && ip !== "::1" && ip !== "localhost" && ip !== "::ffff:127.0.0.1") {
        return reply.code(403).send({ error: "\u7BA1\u7406\u7AEF\u4EC5\u5141\u8BB8\u672C\u673A\u8BBF\u95EE" });
      }
    }
  });
  fastify.post("/api/admin/folder", async (request, reply) => {
    try {
      const { path: dirPath, name, root } = request.body;
      if (!name) {
        return reply.code(400).send({ error: "\u7F3A\u5C11\u6587\u4EF6\u5939\u540D\u79F0" });
      }
      const rootDir = getRoot(root);
      const safePath = validatePath(dirPath || "/", rootDir);
      const result = createFolder(safePath, name);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.put("/api/admin/folder", async (request, reply) => {
    try {
      const { path: dirPath, oldName, newName, root } = request.body;
      if (!oldName || !newName) {
        return reply.code(400).send({ error: "\u7F3A\u5C11 oldName \u6216 newName" });
      }
      const rootDir = getRoot(root);
      const safePath = validatePath(dirPath || "/", rootDir);
      const result = renameFolder(safePath, oldName, newName);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.delete("/api/admin/folder", async (request, reply) => {
    try {
      const { path: dirPath, name, root } = request.body;
      if (!name) {
        return reply.code(400).send({ error: "\u7F3A\u5C11\u6587\u4EF6\u5939\u540D\u79F0" });
      }
      const rootDir = getRoot(root);
      const safePath = validatePath(dirPath || "/", rootDir);
      const result = deleteFolder(safePath, name);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.delete("/api/admin/file", async (request, reply) => {
    try {
      const { path: filePath, root } = request.body;
      if (!filePath) {
        return reply.code(400).send({ error: "\u7F3A\u5C11\u6587\u4EF6\u8DEF\u5F84" });
      }
      const rootDir = getRoot(root);
      const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
      const parts = normalized.split("/");
      const filename = parts.pop();
      const subDir = parts.length > 0 ? "/" + parts.join("/") : "/";
      const safePath = validatePath(subDir, rootDir);
      const result = deleteFile(safePath, filename);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.get("/api/admin/config", async () => {
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
  fastify.put("/api/admin/config", async (request, reply) => {
    try {
      const updates = request.body;
      saveUserConfig(updates);
      Object.assign(opts.config, updates);
      return { status: "ok", message: "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u91CD\u542F\u670D\u52A1\u540E\u751F\u6548" };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
  fastify.get("/api/admin/status", async () => {
    const disk = getDiskInfo(downloadDir);
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      downloadDir,
      uploadDir: opts.config.storage.uploadDir,
      tempDir: opts.config.storage.tempDir,
      disk
    };
  });
  fastify.post("/api/admin/open-folder", async (request, reply) => {
    try {
      const targetPath = request.body?.path || "/";
      const rootDir = getRoot(request.body?.root);
      const safePath = validatePath(targetPath, rootDir);
      const platform = process.platform;
      let cmd;
      if (platform === "win32") {
        const winPath = safePath.replace(/\//g, "\\");
        cmd = `explorer "${winPath}"`;
      } else if (platform === "darwin") {
        cmd = `open "${safePath}"`;
      } else {
        cmd = `xdg-open "${safePath}"`;
      }
      (0, import_node_child_process.exec)(cmd, (err) => {
        if (err) {
          return reply.code(500).send({ error: "\u6253\u5F00\u76EE\u5F55\u5931\u8D25: " + err.message });
        }
      });
      return { status: "ok", path: safePath };
    } catch (err) {
      reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.get("/api/admin/qrcode", async () => {
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

// src/app.js
var import_meta2 = {};
function findWebDir() {
  const serverDir = typeof __dirname !== "undefined" ? __dirname : (0, import_node_path7.dirname)((0, import_node_url2.fileURLToPath)(import_meta2.url));
  const candidates = [
    (0, import_node_path7.join)(process.cwd(), "web"),
    (0, import_node_path7.resolve)(serverDir, "../../web/dist"),
    (0, import_node_path7.resolve)(serverDir, "../web/dist")
  ];
  for (const p of candidates) {
    if ((0, import_node_fs6.existsSync)((0, import_node_path7.join)(p, "index.html"))) return p;
  }
  return null;
}
async function buildApp(config) {
  const app = (0, import_fastify.default)({
    logger: false,
    bodyLimit: config.upload.chunkSize + 1024 * 1024,
    routerOptions: { maxParamLength: 500 }
  });
  await app.register(import_cors.default, { origin: true });
  await app.register(import_multipart.default, {
    limits: {
      fileSize: config.upload.chunkSize + 1024 * 1024,
      files: 1
    }
  });
  const webDir = findWebDir();
  if (webDir) {
    await app.register(import_static.default, { root: webDir, prefix: "/" });
  }
  await app.register(filesRoutes, { config });
  await app.register(uploadRoutes, { config });
  await app.register(downloadRoutes, { config });
  await app.register(adminRoutes, { config, prefix: "" });
  if (webDir) {
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }
  return app;
}

// src/index.js
var import_node_child_process2 = require("node:child_process");
async function start() {
  const config = loadConfig();
  await initDb();
  const { existsSync: existsSync7, rmSync: rmSync2 } = await import("node:fs");
  const { resolve: resolve7 } = await import("node:path");
  const chunksDir = resolve7(config.storage.tempDir, "chunks");
  if (existsSync7(chunksDir)) {
    rmSync2(chunksDir, { recursive: true, force: true });
    console.log("[startup] \u5DF2\u6E05\u7406\u6B8B\u7559\u4E34\u65F6\u5206\u7247");
  }
  const app = await buildApp(config);
  try {
    await app.listen({ port: config.server.port, host: config.server.host });
  } catch (err) {
    if (err.code === "EADDRINUSE") {
      console.error(`\u7AEF\u53E3 ${config.server.port} \u5DF2\u88AB\u5360\u7528\uFF0C\u8BF7\u66F4\u6362\u7AEF\u53E3`);
      process.exit(1);
    }
    throw err;
  }
  const ip = getLanIP();
  const url = `http://${ip}:${config.server.port}`;
  const localUrl = `http://127.0.0.1:${config.server.port}`;
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("  my-net-disk \u5DF2\u542F\u52A8");
  console.log(`  \u672C\u673A\u8BBF\u95EE: ${localUrl}`);
  console.log(`  \u5C40\u57DF\u7F51:   ${url}`);
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("  \u626B\u63CF\u4E0B\u65B9\u4E8C\u7EF4\u7801\u4ECE\u624B\u673A\u8BBF\u95EE\uFF1A");
  const qrSvg = await generateQrSvg(url, {
    width: config.qrcode.size,
    color: config.qrcode.color,
    bgColor: config.qrcode.bgColor
  });
  console.log(qrSvg);
  console.log("  \u6309 Ctrl+C \u9000\u51FA\u670D\u52A1");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  if (config.server.autoOpen) {
    const platform = process.platform;
    let cmd;
    if (platform === "win32") {
      cmd = `start ${localUrl}`;
    } else if (platform === "darwin") {
      cmd = `open ${localUrl}`;
    } else {
      cmd = `xdg-open ${localUrl}`;
    }
    (0, import_node_child_process2.exec)(cmd);
  }
  const shutdown = () => {
    console.log("\n\u6B63\u5728\u5173\u95ED\u670D\u52A1...");
    app.close().then(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
start().catch((err) => {
  console.error("\u542F\u52A8\u5931\u8D25:", err);
  process.exit(1);
});
