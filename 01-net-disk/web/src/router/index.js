import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
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
    path: '/',
    component: () => import('../pages/client/FileBrowser.vue'),
    meta: { client: true }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
