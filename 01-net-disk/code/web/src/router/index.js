import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  // 默认跳转管理端
  { path: '/', redirect: '/admin' },
  // 管理端
  {
    path: '/admin',
    component: () => import('../pages/admin/Dashboard.vue'),
    meta: { admin: true }
  },
  {
    path: '/admin/files',
    component: () => import('../pages/admin/FileManager.vue'),
    meta: { admin: true }
  },
  {
    path: '/admin/settings',
    component: () => import('../pages/admin/Settings.vue'),
    meta: { admin: true }
  },
  // 客户端
  {
    path: '/browse',
    component: () => import('../pages/client/FileBrowser.vue'),
    meta: { client: true }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
