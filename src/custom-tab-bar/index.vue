<template>
  <view class="tab-bar" :style="themeStore.cssVariables">
    <view v-for="(tab, index) in tabs" :key="tab.pagePath" :class="['tab-item', { active: selected === tab.pagePath }]" @click="switchTab(tab)">
      <view class="tab-icon-wrap">
        <!-- 图标名随主题切换（各主题 icons.tab），颜色由 u-icon 内联，选中态用主题主色 -->
        <u-icon :name="themeStore.currentTheme.icons.tab[index]" :size="23" :color="selected === tab.pagePath ? themeStore.currentTheme.colors.primary : themeStore.currentTheme.colors.tabInactive" />
      </view>
      <text class="tab-label">{{ tab.text }}</text>
    </view>
  </view>
</template>

<script setup>
import { getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { themeStore } from '../stores/theme'

const tabs = [
  { pagePath: 'pages/ledger/index', text: '账本' },
  { pagePath: 'pages/ledger/expense-statistics', text: '统计' },
  { pagePath: 'pages/chat/index', text: '助手' },
  { pagePath: 'pages/profile/index', text: '我的' }
]
const selected = ref(tabs[0].pagePath)

const instance = getCurrentInstance()

onMounted(() => {
  syncSelected()
  try { uni.hideTabBar({ animation: false }) } catch { /* 非 tab 页面或平台不支持时忽略 */ }
  // #ifdef APP-PLUS
  measureHeight()
  // #endif
})
onShow(() => {
  syncSelected()
  // 立即同步一次，并在框架可能异步重置后再补一次（applyStatusBar 内部幂等，状态一致时不写原生）
  themeStore.syncStatusBar()
  setTimeout(() => themeStore.syncStatusBar(), 300)
})

// #ifdef APP-PLUS
function measureHeight() {
  nextTick(() => {
    uni.createSelectorQuery().in(instance?.proxy)
      .select('.tab-bar')
      .boundingClientRect((rect) => {
        if (rect?.height) themeStore.appTabBar.heightPx = Math.ceil(rect.height)
      })
      .exec()
  })
}
// #endif

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
.tab-bar { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; display: flex; min-height: 112rpx; padding: 14rpx 16rpx calc(14rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid var(--theme-border); background: var(--theme-surface); box-shadow: 0 -10rpx 30rpx rgba(28, 39, 59, .06); box-sizing: border-box; }
.tab-item { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 5rpx; min-width: 0; color: var(--theme-tab-inactive); }
.tab-icon-wrap { display: flex; align-items: center; justify-content: center; width: 54rpx; height: 46rpx; border-radius: var(--theme-radius-control, 16rpx); transition: all .2s ease; }
.tab-label { color: inherit; font-size: 28rpx; line-height: 1.2; transition: all .2s ease; }
.tab-item.active { color: var(--theme-primary); }
.tab-item.active .tab-icon-wrap { color: var(--theme-primary); background: var(--theme-primary-soft); box-shadow: 0 5rpx 12rpx var(--theme-primary-shadow); }
.tab-item.active .tab-label { font-weight: 600; }
</style>
