<template>
  <div>
    <a-button type="primary" @click="showDialog = true">
      <upload-outlined /> 上传文件
    </a-button>

    <a-modal
      v-model:open="showDialog"
      title="上传文件"
      :footer="null"
      width="520px"
      @cancel="onClose"
    >
      <!-- 拖拽区域 -->
      <a-upload-dragger
        :show-upload-list="false"
        multiple
        :before-upload="handleBeforeUpload"
        style="margin-bottom:16px"
      >
        <p class="ant-upload-drag-icon">
          <inbox-outlined style="font-size:48px;color:#1677ff" />
        </p>
        <p>点击或拖拽文件到此区域上传</p>
        <p class="ant-upload-hint">支持大文件分片上传，单文件最大 10GB</p>
      </a-upload-dragger>

      <!-- 任务列表 -->
      <div v-if="taskList.length > 0" class="task-list">
        <div v-for="item in taskList" :key="item.id" class="task-item">
          <div class="task-info">
            <span class="task-name">{{ item.filename }}</span>
            <span class="task-size">{{ formatSize(item.totalSize) }}</span>
          </div>
          <a-progress
            :percent="item.progress"
            :status="item.status === 'failed' ? 'exception' : item.status === 'done' ? 'success' : 'active'"
            size="small"
          />
          <div class="task-meta">
            <span v-if="item.status === 'uploading'" class="task-speed">{{ formatSpeed(item.speed) }}</span>
            <span class="task-status">
              <a-tag v-if="item.status === 'preparing'" color="processing">准备中</a-tag>
              <a-tag v-else-if="item.status === 'uploading'" color="processing">上传中</a-tag>
              <a-tag v-else-if="item.status === 'merging'" color="warning">合并中</a-tag>
              <a-tag v-else-if="item.status === 'done'" color="success">完成</a-tag>
              <a-tag v-else-if="item.status === 'failed'" color="error">失败</a-tag>
            </span>
            <span v-if="item.error" class="task-error">{{ item.error }}</span>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons-vue';
import { useChunkedUpload } from '../utils/chunkedUpload.js';

const props = defineProps({
  root: { type: String, default: 'download' }
});
const emit = defineEmits(['uploaded']);

const { tasks, uploadFile, formatSize, formatSpeed } = useChunkedUpload();
const showDialog = ref(false);
const doneSet = ref(new Set());

const taskList = computed(() => {
  return Object.values(tasks).sort((a, b) => b.id.localeCompare(a.id));
});

function handleBeforeUpload(file) {
  uploadFile(file, '', props.root).then(result => {
    if (result.status === 'done') {
      doneSet.value = new Set([...doneSet.value, result.id]);
      emit('uploaded');
    }
  });
  return false;
}

function onClose() {
  // 不清空已完成任务，方便查看
}
</script>

<style scoped>
.task-list {
  max-height: 320px;
  overflow-y: auto;
}
.task-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.task-item:last-child {
  border-bottom: none;
}
.task-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.task-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}
.task-size {
  color: #999;
  font-size: 13px;
}
.task-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 12px;
}
.task-speed {
  color: #1677ff;
}
.task-error {
  color: #ff4d4f;
}
</style>
