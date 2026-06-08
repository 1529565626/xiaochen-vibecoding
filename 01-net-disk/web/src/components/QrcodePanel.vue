<template>
  <div class="qr-panel">
    <a-button type="primary" shape="circle" size="large" @click="visible = !visible">
      <qrcode-outlined />
    </a-button>
    <div v-if="visible" class="qr-popup">
      <div class="qr-header">
        <span>手机扫码访问</span>
        <a-button type="text" size="small" @click="visible = false">×</a-button>
      </div>
      <div class="qr-body">
        <div v-if="loading" class="qr-loading">
          <a-spin />
        </div>
        <div v-else-if="svg" v-html="svg" class="qr-svg"></div>
      </div>
      <div class="qr-url">{{ url }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { QrcodeOutlined } from '@ant-design/icons-vue';
import { api } from '../utils/api.js';

const visible = ref(true);
const loading = ref(false);
const svg = ref('');
const url = ref('');

async function loadQr() {
  loading.value = true;
  try {
    const data = await api.getQrcode();
    svg.value = data.svg;
    url.value = data.url;
  } catch (e) {
    svg.value = '';
  }
  loading.value = false;
}

onMounted(loadQr);
</script>

<style scoped>
.qr-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}
.qr-popup {
  position: absolute;
  bottom: 56px;
  right: 0;
  width: 260px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
}
.qr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #fafafa;
  font-size: 14px;
  font-weight: 500;
}
.qr-body {
  padding: 16px;
  display: flex;
  justify-content: center;
  min-height: 200px;
  align-items: center;
}
.qr-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-svg :deep(svg) {
  width: 200px;
  height: 200px;
}
.qr-url {
  padding: 8px 14px 14px;
  text-align: center;
  font-size: 13px;
  color: #666;
  word-break: break-all;
  border-top: 1px solid #f0f0f0;
}
</style>
