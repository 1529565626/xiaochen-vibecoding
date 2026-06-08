<template>
  <div class="dashboard">
    <h2>仪表盘</h2>
    <a-row :gutter="16">
      <a-col :span="8">
        <a-card title="服务状态">
          <a-descriptions :column="1" size="small">
            <a-descriptions-item label="运行时长">{{ formatUptime(status.uptime) }}</a-descriptions-item>
            <a-descriptions-item label="监听端口">{{ config?.server?.port || 3000 }}</a-descriptions-item>
            <a-descriptions-item label="下载目录">{{ config?.storage?.downloadDir }}</a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="内存使用">
          <a-statistic title="堆内存 (MB)" :value="memMB(status.memory?.heapUsed)" :precision="1" />
          <a-progress
            :percent="memPercent(status.memory)"
            :stroke-color="{ from: '#1677ff', to: '#ff4d4f' }"
            style="margin-top:12px"
          />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="快速入口">
          <a-space direction="vertical">
            <a-button type="primary" @click="$router.push('/admin/files')">
              <folder-outlined /> 文件管理
            </a-button>
            <a-button @click="$router.push('/admin/settings')">
              <setting-outlined /> 系统配置
            </a-button>
            <a-button @click="openFolder('')">
              <folder-open-outlined /> 打开本地目录
            </a-button>
            <a-button @click="openClient">打开客户端</a-button>
          </a-space>
        </a-card>
      </a-col>
    </a-row>
    <QrcodePanel />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { FolderOutlined, FolderOpenOutlined, SettingOutlined } from '@ant-design/icons-vue';
import { api } from '../../utils/api.js';
import QrcodePanel from '../../components/QrcodePanel.vue';

const status = ref({ uptime: 0, memory: {} });
const config = ref(null);

function formatUptime(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function memMB(bytes) {
  if (!bytes) return 0;
  return bytes / 1024 / 1024;
}

function memPercent(mem) {
  if (!mem?.heapTotal) return 0;
  return Math.round((mem.heapUsed / mem.heapTotal) * 100);
}

async function openFolder(dirPath) {
  try {
    await api.openFolder(dirPath);
  } catch (e) {
    alert('打开目录失败: ' + e.message);
  }
}

function openClient() {
  window.open('/#/', '_blank');
}

onMounted(async () => {
  try { status.value = await api.getStatus(); } catch (e) { /* */ }
  try { config.value = (await api.getConfig()).config; } catch (e) { /* */ }
});
</script>

<style scoped>
.dashboard h2 {
  margin-bottom: 16px;
}
</style>
