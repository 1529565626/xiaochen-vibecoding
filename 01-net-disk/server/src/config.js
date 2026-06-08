import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function getBaseDir() {
  return typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
}

function findConfigPath(filename) {
  const candidates = [
    join(process.cwd(), 'config', filename),         // release: ./config/
    resolve(getBaseDir(), '../config', filename),    // dev: server/src/../config/
    resolve(getBaseDir(), '../../config', filename)  // alternative
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // fallback to release path for writing new configs
  return join(process.cwd(), 'config', filename);
}

function loadConfig() {
  const configPath = findConfigPath('default.json');
  const raw = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  const userConfigPath = findConfigPath('user.json');
  if (existsSync(userConfigPath)) {
    const userRaw = readFileSync(userConfigPath, 'utf-8');
    const userConfig = JSON.parse(userRaw);
    deepMerge(config, userConfig);
  }

  for (const key of ['downloadDir', 'uploadDir', 'tempDir']) {
    const dirPath = config.storage[key];
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  return config;
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function saveUserConfig(updates) {
  const userConfigPath = findConfigPath('user.json');
  let existing = {};
  if (existsSync(userConfigPath)) {
    existing = JSON.parse(readFileSync(userConfigPath, 'utf-8'));
  }
  deepMerge(existing, updates);
  writeFileSync(userConfigPath, JSON.stringify(existing, null, 2), 'utf-8');
}

export { loadConfig, saveUserConfig };
