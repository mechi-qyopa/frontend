<template>
  <view class="tab-bar" :style="themeStore.cssVariables">
    <!-- 猫咪主题：探头白猫趴在导航栏顶边中央（不拦截点击） -->
    <image v-if="mascots" class="tab-cat" :src="mascots.tabcat" mode="aspectFit" />
    <view v-for="(tab, index) in tabs" :key="tab.pagePath" :class="['tab-item', { active: selected === tab.pagePath }]" :aria-label="tab.text" @click="switchTab(tab)">
      <view class="tab-icon-wrap">
        <!-- 猫咪主题：选中项上方小爪印指示 -->
        <image v-if="mascots && selected === tab.pagePath" class="tab-active-paw" :src="mascots.cherry" mode="aspectFit" />
        <!-- 图标名随主题切换（各主题 icons.tab）；选中态为主色渐变圆角方底、白图标 -->
        <u-icon :name="themeStore.currentTheme.icons.tab[index]" :size="22" :color="selected === tab.pagePath ? '#ffffff' : themeStore.currentTheme.colors.tabInactive" />
      </view>
      <text class="tab-label">{{ mascots ? tab.text + '喵' : tab.text }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { themeStore } from '../stores/theme'

const mascots = computed(() => themeStore.currentTheme.mascots || null)

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
        // 平底栏贴底：视觉遮挡 = 栏体本身（内含底部安全区），chat 页按此收缩页面高度
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
/* 平底导航栏：贴底全宽、仅一条发丝线上边，作为安静的"系统框架"层；悬浮胶囊输入框保持"工具"感，两种形态不抢戏 */
.tab-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 100; display: flex; padding: 12rpx 16rpx calc(10rpx + env(safe-area-inset-bottom, 0px)); border-top: 1rpx solid var(--theme-border); background: var(--theme-surface); box-sizing: border-box; }
.tab-item { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 4rpx; min-width: 0; border-radius: var(--theme-radius-control, 16rpx); color: var(--theme-tab-inactive); transition: transform .15s ease; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.tab-item:active { transform: scale(.94); }
/* 猫咪主题：探头白猫（奶油圆底衬托，pointer-events 不拦截 tab 点击） */
.tab-cat { position: absolute; top: -38rpx; left: 50%; margin-left: -44rpx; width: 88rpx; height: 88rpx; padding: 12rpx; box-sizing: border-box; background: var(--theme-primary-soft); border-radius: 50%; box-shadow: 0 6rpx 16rpx rgba(93, 58, 21, .16); pointer-events: none; }
.tab-item.active .tab-active-paw { position: absolute; top: -30rpx; left: 50%; margin-left: -15rpx; width: 30rpx; height: 30rpx; transform: rotate(-18deg); }
.tab-icon-wrap { position: relative; display: flex; align-items: center; justify-content: center; width: 60rpx; height: 52rpx; border-radius: var(--theme-radius-control, 16rpx); transition: background .2s ease, box-shadow .2s ease; }
/* 选中项：主色渐变圆角方托起白图标，label 同步主色 */
.tab-item.active { color: var(--theme-primary); }
.tab-item.active .tab-icon-wrap { background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); box-shadow: 0 6rpx 14rpx var(--theme-primary-shadow); }
.tab-item.active .tab-label { font-weight: 600; }
.tab-label { color: inherit; font-size: 21rpx; line-height: 1.2; transition: color .2s ease; }
</style>
