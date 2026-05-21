<template>
  <div class="file-list">
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-breadcrumb>
        <a-breadcrumb-item v-for="(part, idx) in breadcrumbs" :key="idx">
          <a v-if="idx < breadcrumbs.length - 1" @click="navigateTo(idx)">{{ part.label }}</a>
          <span v-else>{{ part.label }}</span>
        </a-breadcrumb-item>
      </a-breadcrumb>
      <div v-if="admin" class="toolbar-actions">
        <a-button type="primary" size="small" @click="showNewFolder = true">
          <folder-add-outlined /> 新建文件夹
        </a-button>
        <a-upload :show-upload-list="false" multiple @change="onUploadChange">
          <a-button size="small">
            <upload-outlined /> 上传文件
          </a-button>
        </a-upload>
        <a-button size="small" @click="refresh">
          <reload-outlined /> 刷新
        </a-button>
        <a-button size="small" @click="viewMode = viewMode === 'list' ? 'grid' : 'list'">
          <unordered-list-outlined v-if="viewMode === 'grid'" />
          <appstore-outlined v-else />
        </a-button>
      </div>
    </div>

    <!-- 新文件夹弹窗 -->
    <a-modal v-model:open="showNewFolder" title="新建文件夹" @ok="doCreateFolder" ok-text="创建" cancel-text="取消">
      <a-input v-model:value="newFolderName" placeholder="文件夹名称" @press-enter="doCreateFolder" />
    </a-modal>

    <!-- 重命名弹窗 -->
    <a-modal v-model:open="showRename" title="重命名" @ok="doRename" ok-text="确认" cancel-text="取消">
      <a-input v-model:value="renameValue" placeholder="新名称" @press-enter="doRename" />
    </a-modal>

    <!-- 文件列表：表格模式 -->
    <a-spin v-if="viewMode === 'list'" :spinning="loading">
      <a-table
        :dataSource="items"
        :columns="columns"
        :pagination="false"
        size="small"
        row-key="name"
        @row-click="onRowClick"
        style="cursor:pointer"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span style="margin-right:8px">
              <folder-outlined v-if="record.type === 'directory'" style="color:#faad14" />
              <file-outlined v-else style="color:#999" />
            </span>
            {{ record.name }}
          </template>
          <template v-else-if="column.key === 'size'">
            {{ record.type === 'directory' ? '-' : formatSize(record.size) }}
          </template>
          <template v-else-if="column.key === 'modifiedAt'">
            {{ formatDate(record.modifiedAt) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space v-if="admin" @click.stop>
              <a-button type="link" size="small" @click.stop="startRename(record)">重命名</a-button>
              <a-popconfirm title="确认删除？" @confirm="doDelete(record)" ok-text="删除" cancel-text="取消">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
            <a-button v-if="record.type === 'file'" type="link" size="small" @click.stop="downloadFile(record)">
              <download-outlined />
            </a-button>
          </template>
        </template>
      </a-table>
    </a-spin>

    <!-- 文件列表：平铺模式 -->
    <a-spin v-else :spinning="loading">
      <div v-if="items.length === 0 && !loading" class="empty-grid">空目录</div>
      <div v-else class="file-grid">
        <div
          v-for="item in items"
          :key="item.name"
          class="file-card"
          @click="onRowClick(item)"
        >
          <div class="file-icon">
            <folder-outlined v-if="item.type === 'directory'" style="font-size:40px;color:#faad14" />
            <file-outlined v-else style="font-size:40px;color:#bbb" />
          </div>
          <div class="file-name" :title="item.name">{{ item.name }}</div>
          <div class="file-meta">
            {{ item.type === 'directory' ? '文件夹' : formatSize(item.size) }}
          </div>
          <div v-if="admin" class="file-actions" @click.stop>
            <a-button type="link" size="small" @click.stop="startRename(item)">重命名</a-button>
            <a-popconfirm title="确认删除？" @confirm="doDelete(item)" ok-text="删除" cancel-text="取消">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import {
  FolderOutlined, FileOutlined, FolderAddOutlined,
  UploadOutlined, DownloadOutlined, ReloadOutlined,
  UnorderedListOutlined, AppstoreOutlined
} from '@ant-design/icons-vue';
import { api } from '../utils/api.js';

const props = defineProps({
  admin: { type: Boolean, default: false },
  root: { type: String, default: 'download' }
});

const emit = defineEmits(['upload']);

const loading = ref(false);
const currentPath = ref('/');
const items = ref([]);
const viewMode = ref('list'); // list | grid
const showNewFolder = ref(false);
const newFolderName = ref('');
const showRename = ref(false);
const renameValue = ref('');
const renameTarget = ref(null);

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

const columns = computed(() => {
  const base = [
    { title: '名称', key: 'name', dataIndex: 'name' },
    { title: '大小', key: 'size', dataIndex: 'size', width: 120 },
    { title: '修改时间', key: 'modifiedAt', dataIndex: 'modifiedAt', width: 180 },
    { title: '操作', key: 'actions', width: props.admin ? 180 : 60 }
  ];
  return base;
});

function refresh() {
  loadFiles(currentPath.value);
}

async function loadFiles(dir = '/') {
  loading.value = true;
  try {
    const data = await api.listFiles(dir, props.root);
    items.value = data.items || [];
    currentPath.value = dir;
  } catch (e) {
    items.value = [];
  }
  loading.value = false;
}

function navigateTo(idx) {
  const crumb = breadcrumbs.value[idx];
  if (crumb) loadFiles(crumb.path);
}

function onRowClick(record) {
  if (record.type === 'directory') {
    loadFiles(currentPath.value === '/' ? `/${record.name}` : `${currentPath.value}/${record.name}`);
  }
}

function downloadFile(record) {
  const filePath = currentPath.value === '/' ? `/${record.name}` : `${currentPath.value}/${record.name}`;
  const url = api.getDownloadUrl(filePath, props.root);
  const a = document.createElement('a');
  a.href = url;
  a.download = record.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function onUploadChange(info) {
  if (info.file.status === 'done') {
    loadFiles(currentPath.value);
  }
}

async function doCreateFolder() {
  if (!newFolderName.value.trim()) return;
  try {
    await api.createFolder(currentPath.value, newFolderName.value.trim(), props.root);
    showNewFolder.value = false;
    newFolderName.value = '';
    loadFiles(currentPath.value);
  } catch (e) {
    alert(e.message);
  }
}

function startRename(record) {
  renameTarget.value = record;
  renameValue.value = record.name;
  showRename.value = true;
}

async function doRename() {
  if (!renameValue.value.trim() || !renameTarget.value) return;
  try {
    await api.renameFolder(currentPath.value, renameTarget.value.name, renameValue.value.trim(), props.root);
    showRename.value = false;
    loadFiles(currentPath.value);
  } catch (e) {
    alert(e.message);
  }
}

async function doDelete(record) {
  try {
    if (record.type === 'directory') {
      await api.deleteFolder(currentPath.value, record.name, props.root);
    } else {
      const p = currentPath.value === '/' ? `/${record.name}` : `${currentPath.value}/${record.name}`;
      await api.deleteFile(p, props.root);
    }
    loadFiles(currentPath.value);
  } catch (e) {
    alert(e.message);
  }
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

watch(() => props.admin, () => loadFiles('/'), { immediate: true });
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
}
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
.file-icon { margin-bottom: 6px; }
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
  margin-bottom: 2px;
}
.file-meta { font-size: 12px; color: #999; margin-bottom: 4px; }
.file-actions { display: flex; gap: 0; }
.empty-grid { text-align: center; padding: 48px 0; color: #999; }
</style>
