<template>
  <view class="transfer-page" :style="themeStore.cssVariables">
    <view class="transfer-intro">
      <text class="intro-title">导入导出</text>
      <text class="intro-description">把记账流水导出为 Excel 备份，也可以从 Excel 文件批量导入流水。</text>
    </view>

    <view class="card action-card" @click="handleExport">
      <view><text class="action-title">导出 Excel</text><text class="action-subtitle">下载全部流水的 Excel 文件</text></view>
      <text class="action-arrow">{{ exporting ? '导出中…' : '›' }}</text>
    </view>
    <view class="card action-card" @click="handleImport">
      <view><text class="action-title">导入 Excel</text><text class="action-subtitle">从 Excel 文件批量导入流水</text></view>
      <text class="action-arrow">{{ importing ? '导入中…' : '›' }}</text>
    </view>

    <view class="card tips-card">
      <text class="tips-title">导入模板说明</text>
      <text class="tips-line">1. 表头依次为：日期、类型、分类、金额、备注。</text>
      <text class="tips-line">2. 日期格式 yyyy-MM-dd；类型填 收入 或 支出；金额大于 0 且最多两位小数。</text>
      <text class="tips-line">3. 分类需要已存在，优先匹配自定义分类，其次匹配系统分类。</text>
      <text class="tips-line">4. 单次最多导入 2000 行，备注最多 255 字，失败的行会逐条提示。</text>
    </view>

    <view v-if="importResult" class="card result-card">
      <text class="result-title">导入结果</text>
      <view class="result-stats">
        <view class="result-stat"><text class="result-value">{{ importResult.importedCount }}</text><text class="result-label">成功</text></view>
        <view class="result-stat"><text class="result-value" :class="{ failed: importResult.failedCount > 0 }">{{ importResult.failedCount }}</text><text class="result-label">失败</text></view>
      </view>
      <view v-if="importResult.errors && importResult.errors.length" class="result-errors">
        <text v-for="(error, index) in importResult.errors" :key="index" class="result-error">{{ error }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { appApi } from '../../api/app'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'

const exporting = ref(false)
const importing = ref(false)
const importResult = ref(null)

// #ifdef APP-PLUS
function chooseExcelFile() {
  return Promise.reject(new Error('App 端暂不支持选择文件，请使用 H5 网页版导入'))
}
// #endif
// #ifndef APP-PLUS
function chooseExcelFile() {
  return new Promise((resolve, reject) => {
    uni.chooseFile({
      count: 1,
      extension: ['.xlsx', '.xls'],
      success: ({ tempFilePaths }) => resolve(tempFilePaths && tempFilePaths[0]),
      fail: () => reject(new Error('未选择文件'))
    })
  })
}
// #endif

async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    await appApi.exportTransactions()
    uni.showToast({ title: '导出成功', icon: 'success' })
  } catch (error) {
    showRequestError(error)
  } finally {
    exporting.value = false
  }
}

async function handleImport() {
  if (importing.value) return
  try {
    const filePath = await chooseExcelFile()
    if (!filePath) return
    importing.value = true
    importResult.value = await appApi.importTransactions(filePath)
    if (importResult.value.failedCount > 0) {
      uni.showToast({ title: '部分数据导入失败，请查看结果', icon: 'none' })
    } else {
      uni.showToast({ title: `成功导入 ${importResult.value.importedCount} 条流水`, icon: 'success' })
    }
  } catch (error) {
    if (!String(error?.message || '').includes('未选择文件')) showRequestError(error)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.transfer-page { min-height: 100vh; padding: 32rpx 0 calc(48rpx + env(safe-area-inset-bottom)); color: var(--theme-text); background: var(--theme-page-bg); box-sizing: border-box; }
.transfer-intro { margin: 8rpx 32rpx 8rpx; }
.intro-title, .intro-description { display: block; }
.intro-title { color: var(--theme-text-strong); font-size: 40rpx; font-weight: 700; }
.intro-description { margin-top: 12rpx; color: var(--theme-text-muted); font-size: 25rpx; line-height: 1.6; }
.action-card { display: flex; align-items: center; justify-content: space-between; }
.action-card:active { transform: scale(.99); }
.action-title, .action-subtitle { display: block; }
.action-title { color: var(--theme-text-strong); font-size: 29rpx; font-weight: 600; }
.action-subtitle { margin-top: 10rpx; color: var(--theme-text-muted); font-size: 23rpx; }
.action-arrow { color: var(--theme-text-muted); font-size: 26rpx; }
.tips-title { display: block; margin-bottom: 16rpx; color: var(--theme-text-strong); font-size: 26rpx; font-weight: 600; }
.tips-line { display: block; margin-top: 8rpx; color: var(--theme-text-muted); font-size: 23rpx; line-height: 1.6; }
.result-title { display: block; margin-bottom: 20rpx; color: var(--theme-text-strong); font-size: 29rpx; font-weight: 600; }
.result-stats { display: flex; margin-bottom: 12rpx; }
.result-stat { display: flex; flex: 1; flex-direction: column; align-items: center; gap: 8rpx; }
.result-stat + .result-stat { border-left: 1rpx solid var(--theme-border); }
.result-value { color: var(--theme-primary); font-size: 38rpx; font-weight: 700; }
.result-value.failed { color: #e5484d; }
.result-label { color: var(--theme-text-muted); font-size: 22rpx; }
.result-errors { margin-top: 12rpx; padding-top: 16rpx; border-top: 1rpx solid var(--theme-border); }
.result-error { display: block; margin-top: 8rpx; color: #e5484d; font-size: 23rpx; line-height: 1.5; }
</style>
