<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">文件管理</h2>
      <a-button @click="openCurrentFolder">
        <folder-open-outlined /> 打开本地目录
      </a-button>
    </div>
    <!-- Tab 切换 -->
    <a-tabs v-model:activeKey="root" @change="onTabChange" style="margin-bottom:0">
      <a-tab-pane key="download" tab="下载目录" />
      <a-tab-pane key="upload" tab="上传目录" />
    </a-tabs>
    <FileList :admin="true" :root="root" :key="root" />
    <QrcodePanel />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { FolderOpenOutlined } from '@ant-design/icons-vue';
import FileList from '../../components/FileList.vue';
import QrcodePanel from '../../components/QrcodePanel.vue';
import { api } from '../../utils/api.js';

const root = ref('download');

function onTabChange() {
  // FileList 的 :key="root" 会在 root 变化时强制重建，自动加载新目录
}

async function openCurrentFolder() {
  try {
    await api.openFolder('/', root.value);
  } catch (e) {
    alert('打开目录失败: ' + e.message);
  }
}
</script>
