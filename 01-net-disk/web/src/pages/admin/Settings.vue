<template>
  <div class="settings">
    <h2>系统配置</h2>
    <a-spin :spinning="loading">
      <a-card title="服务基础配置" style="margin-bottom:16px">
        <a-form :model="form" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="端口">
                <a-input-number v-model:value="form.server.port" :min="1" :max="65535" style="width:100%" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="绑定地址">
                <a-select v-model:value="form.server.host">
                  <a-select-option value="0.0.0.0">0.0.0.0（局域网可访问）</a-select-option>
                  <a-select-option value="127.0.0.1">127.0.0.1（仅本机）</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="启动时自动打开浏览器">
            <a-switch v-model:checked="form.server.autoOpen" />
          </a-form-item>
        </a-form>
      </a-card>

      <a-card title="存储路径" style="margin-bottom:16px">
        <a-form :model="form" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="下载目录（客户端访问）">
                <a-input v-model:value="form.storage.downloadDir" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="上传临时目录">
                <a-input v-model:value="form.storage.uploadDir" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="临时目录">
                <a-input v-model:value="form.storage.tempDir" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-card>

      <a-card title="上传配置" style="margin-bottom:16px">
        <a-form :model="form" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="单文件最大体积 (字节)">
                <a-input-number v-model:value="form.upload.maxFileSize" style="width:100%" />
                <span class="hint">{{ formatSize(form.upload.maxFileSize) }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="批量最大体积 (字节)">
                <a-input-number v-model:value="form.upload.maxBatchSize" style="width:100%" />
                <span class="hint">{{ formatSize(form.upload.maxBatchSize) }}</span>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="分片大小 (字节)">
                <a-input-number v-model:value="form.upload.chunkSize" style="width:100%" />
                <span class="hint">{{ formatSize(form.upload.chunkSize) }}</span>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="并发上传数">
                <a-input-number v-model:value="form.upload.maxConcurrent" :min="1" :max="10" style="width:100%" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="合并超时 (毫秒)">
                <a-input-number v-model:value="form.upload.mergeTimeout" style="width:100%" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="完成后清理临时文件">
                <a-switch v-model:checked="form.upload.cleanupTemp" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-card>

      <a-card title="下载配置" style="margin-bottom:16px">
        <a-form :model="form" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="流缓冲区大小 (字节)">
                <a-input-number v-model:value="form.download.streamHighWaterMark" style="width:100%" />
                <span class="hint">{{ formatSize(form.download.streamHighWaterMark) }}</span>
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-card>

      <a-card title="访问控制" style="margin-bottom:16px">
        <a-form :model="form" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="显示二维码">
                <a-switch v-model:checked="form.access.qrcodeEnabled" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="仅允许本机访问">
                <a-switch v-model:checked="form.access.localOnly" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-card>

      <a-button type="primary" size="large" :loading="saving" @click="saveConfig" style="margin-bottom:16px">
        保存配置
      </a-button>
      <p v-if="saveMsg" :class="saveOk ? 'msg-ok' : 'msg-err'">{{ saveMsg }}</p>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../../utils/api.js';

const loading = ref(true);
const saving = ref(false);
const saveMsg = ref('');
const saveOk = ref(false);

const form = reactive({
  server: { port: 3000, host: '0.0.0.0', autoOpen: true },
  storage: { downloadDir: '', uploadDir: '', tempDir: '' },
  upload: { maxFileSize: 0, maxBatchSize: 0, chunkSize: 0, maxConcurrent: 3, mergeTimeout: 600000, cleanupTemp: true },
  download: { streamHighWaterMark: 1048576 },
  access: { qrcodeEnabled: true, localOnly: false }
});

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

onMounted(async () => {
  try {
    const data = await api.getConfig();
    Object.assign(form, data.config);
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
});

async function saveConfig() {
  saving.value = true;
  saveMsg.value = '';
  try {
    await api.updateConfig({ ...form });
    saveOk.value = true;
    saveMsg.value = '配置已保存，部分配置需重启服务生效';
  } catch (e) {
    saveOk.value = false;
    saveMsg.value = '保存失败: ' + e.message;
  }
  saving.value = false;
}
</script>

<style scoped>
.settings h2 { margin-bottom: 16px; }
.hint { font-size: 12px; color: #999; }
.msg-ok { color: #52c41a; }
.msg-err { color: #ff4d4f; }
</style>
