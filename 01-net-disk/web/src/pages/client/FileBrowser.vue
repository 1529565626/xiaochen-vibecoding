<template>
  <div class="file-browser">
    <!-- Tab 切换 -->
    <a-tabs v-model:activeKey="activeTab" @change="onTabChange" style="margin-bottom:0">
      <a-tab-pane key="download" tab="下载文件" />
      <a-tab-pane key="upload" tab="上传文件" />
    </a-tabs>

    <!-- 工具栏 -->
    <div class="browser-toolbar">
      <a-breadcrumb>
        <a-breadcrumb-item v-for="(crumb, idx) in breadcrumbs" :key="idx">
          <a v-if="idx < breadcrumbs.length - 1" @click="navigateTo(crumb.path)">{{ crumb.label }}</a>
          <span v-else>{{ crumb.label }}</span>
        </a-breadcrumb-item>
      </a-breadcrumb>
      <div class="browser-actions">
        <UploadDialog root="upload" @uploaded="onUploadDone" />
        <a-button size="small" @click="refresh">
          <reload-outlined /> 刷新
        </a-button>
      </div>
    </div>

    <!-- 文件网格 -->
    <a-spin :spinning="loading">
      <div v-if="items.length === 0 && !loading" class="empty-state">
        <inbox-outlined style="font-size:64px;color:#d9d9d9" />
        <p>{{ activeTab === 'download' ? '此目录为空' : '还没有上传过文件' }}</p>
      </div>
      <div v-else class="file-grid">
        <div
          v-for="item in items"
          :key="item.name"
          class="file-card"
          @click="onItemClick(item)"
        >
          <div class="file-icon">
            <folder-outlined v-if="item.type === 'directory'" style="font-size:48px;color:#faad14" />
            <file-outlined v-else style="font-size:48px;color:#bbb" />
          </div>
          <div class="file-name" :title="item.name">{{ item.name }}</div>
          <div class="file-meta">
            {{ item.type === 'directory' ? '文件夹' : formatSize(item.size) }}
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { FolderOutlined, FileOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { api } from '../../utils/api.js';
import UploadDialog from '../../components/UploadDialog.vue';

const loading = ref(false);
const currentPath = ref('/');
const items = ref([]);
const activeTab = ref('download');

const breadcrumbs = computed(() => {
  if (currentPath.value === '/') return [{ label: '根目录', path: '/' }];
  const parts = currentPath.value.split('/').filter(Boolean);
  const crumbs = [{ label: '根目录', path: '/' }];
  let p = '';
  for (const part of parts) {
    p += '/' + part;
    crumbs.push({ label: part, path: p });
  }
  return crumbs;
});

async function loadFiles(dir = '/') {
  loading.value = true;
  try {
    const data = await api.listFiles(dir, activeTab.value);
    items.value = data.items || [];
    currentPath.value = dir;
  } catch (e) {
    items.value = [];
  }
  loading.value = false;
}

function refresh() {
  loadFiles(currentPath.value);
}

function navigateTo(dir) {
  loadFiles(dir);
}

function onUploadDone() {
  // 在上传 tab 时直接刷新文件列表，在其他 tab 时用户切过去 onTabChange 会自动刷新
  if (activeTab.value === 'upload') {
    loadFiles(currentPath.value);
  }
}

function onItemClick(item) {
  if (item.type === 'directory') {
    const p = currentPath.value === '/' ? `/${item.name}` : `${currentPath.value}/${item.name}`;
    loadFiles(p);
    return;
  }
  const filePath = currentPath.value === '/' ? `/${item.name}` : `${currentPath.value}/${item.name}`;
  const url = api.getDownloadUrl(filePath, activeTab.value);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function onTabChange() {
  currentPath.value = '/';
  loadFiles('/');
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

onMounted(() => loadFiles('/'));
</script>

<style scoped>
.browser-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.browser-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.file-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}
.file-card:hover { background: #fafafa; }
.file-card:active { background: #f0f0f0; }
.file-icon { margin-bottom: 8px; }
.file-name {
  font-size: 13px;
  text-align: center;
  word-break: break-all;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 100%;
}
.file-meta { margin-top: 4px; font-size: 12px; color: #999; }
.empty-state { text-align: center; padding: 64px 0; color: #999; }
.empty-state p { margin-top: 16px; }
</style>
