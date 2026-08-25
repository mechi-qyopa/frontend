<template>
  <view class="tab-bar">
    <view v-for="tab in tabs" :key="tab.pagePath" :class="['tab-item', { active: selected === tab.pagePath }]" @click="switchTab(tab)">
      <view class="tab-icon-wrap"><text class="tab-icon">{{ tab.icon }}</text></view>
      <text class="tab-label">{{ tab.text }}</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const tabs = [
  { pagePath: 'pages/ledger/index', text: '账本', icon: '▤' },
  { pagePath: 'pages/ledger/expense-statistics', text: '统计', icon: '◔' },
  { pagePath: 'pages/chat/index', text: '助手', icon: '✦' },
  { pagePath: 'pages/profile/index', text: '我的', icon: '◡' }
]
const selected = ref(tabs[0].pagePath)

onMounted(syncSelected)

function syncSelected() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage?.route && tabs.some(tab => tab.pagePath === currentPage.route)) selected.value = currentPage.route
}

function switchTab(tab) {
  if (selected.value === tab.pagePath) return
  selected.value = tab.pagePath
  uni.switchTab({
    url: `/${tab.pagePath}`,
    fail: syncSelected
  })
}
</script>

<style scoped>
.tab-bar { display: flex; min-height: 112rpx; padding: 14rpx 16rpx calc(14rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid rgba(226, 232, 240, .82); background: rgba(255, 255, 255, .96); box-shadow: 0 -10rpx 30rpx rgba(28, 39, 59, .06); box-sizing: border-box; backdrop-filter: blur(24rpx); }
.tab-item { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 5rpx; min-width: 0; color: #8b95a7; }
.tab-icon-wrap { display: flex; align-items: center; justify-content: center; width: 54rpx; height: 46rpx; border-radius: 16rpx; transition: all .2s ease; }
.tab-icon { color: inherit; font-size: 33rpx; font-weight: 600; line-height: 1; }
.tab-label { color: inherit; font-size: 28rpx; line-height: 1.2; transition: all .2s ease; }
.tab-item.active { color: #1677ff; }
.tab-item.active .tab-icon-wrap { color: #1677ff; background: linear-gradient(135deg, #e9f2ff, #dcecff); box-shadow: 0 5rpx 12rpx rgba(22, 119, 255, .13); }
.tab-item.active .tab-label { font-weight: 600; }
</style>
