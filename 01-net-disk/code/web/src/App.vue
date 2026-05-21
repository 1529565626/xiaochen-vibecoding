<template>
  <a-config-provider :locale="zhCN">
    <div id="app-root">
      <!-- 管理端布局 -->
      <a-layout v-if="isAdminRoute" style="min-height:100vh">
        <a-layout-sider v-model:collapsed="collapsed" collapsible theme="dark">
          <div class="logo">my-net-disk</div>
          <a-menu v-model:selectedKeys="selectedKeys" theme="dark" mode="inline" @click="onMenuClick">
            <a-menu-item key="/admin">
              <dashboard-outlined />
              <span>仪表盘</span>
            </a-menu-item>
            <a-menu-item key="/admin/files">
              <folder-outlined />
              <span>文件管理</span>
            </a-menu-item>
            <a-menu-item key="/admin/settings">
              <setting-outlined />
              <span>系统配置</span>
            </a-menu-item>
            <a-menu-item key="client">
              <global-outlined />
              <span>打开客户端</span>
            </a-menu-item>
          </a-menu>
        </a-layout-sider>
        <a-layout>
          <a-layout-content style="margin:16px">
            <router-view />
          </a-layout-content>
        </a-layout>
      </a-layout>

      <!-- 客户端布局 -->
      <div v-else id="client-layout">
        <header class="client-header">
          <div class="client-title">my-net-disk</div>
          <a-button type="link" @click="$router.push('/admin')">管理端</a-button>
        </header>
        <main class="client-main">
          <router-view />
        </main>
      </div>
    </div>
  </a-config-provider>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  DashboardOutlined,
  FolderOutlined,
  SettingOutlined,
  GlobalOutlined
} from '@ant-design/icons-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';

const route = useRoute();
const router = useRouter();
const collapsed = ref(false);
const selectedKeys = ref([]);

const isAdminRoute = computed(() => route.meta?.admin);

watch(() => route.path, (path) => {
  if (route.meta?.admin) {
    selectedKeys.value = [path];
  }
}, { immediate: true });

function onMenuClick({ key }) {
  if (key === 'client') {
    window.open('/#/', '_blank');
    return;
  }
  router.push(key);
}
</script>

<style scoped>
.logo {
  height: 48px;
  line-height: 48px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  overflow: hidden;
}
.client-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 100;
}
.client-title {
  font-size: 16px;
  font-weight: 600;
  color: #1677ff;
}
.client-main {
  padding: 12px;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
