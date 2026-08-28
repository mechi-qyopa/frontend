<template>
  <view class="theme-page" :style="themeStore.cssVariables">
    <view class="theme-intro">
      <text class="theme-intro-title">主题外观</text>
      <text class="theme-intro-description">选择喜欢的配色，账本、统计和助手会同步切换。</text>
    </view>

    <view class="current-theme-card">
      <view class="current-theme-mark">✓</view>
      <view><text class="current-theme-label">当前使用</text><text class="current-theme-name">{{ themeStore.currentTheme.name }}</text></view>
    </view>

    <view class="theme-grid">
      <view v-for="theme in THEMES" :key="theme.id" :class="['theme-option', { selected: themeStore.id === theme.id }]" @click="selectTheme(theme.id)">
        <!-- App 端 image 不支持 SVG，预览图改用各主题 colors 内联绘制的纯 CSS 示意 -->
        <view class="theme-preview" :style="{ background: theme.colors.pageBackground }">
          <view class="preview-band" :style="{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryEnd})` }"></view>
          <view class="preview-card" :style="{ background: theme.colors.surface }">
            <view class="preview-chip" :style="{ background: theme.colors.primarySoft }">
              <view class="preview-dot" :style="{ background: theme.colors.primary }"></view>
              <view class="preview-slash" :style="{ background: theme.colors.primaryEnd }"></view>
            </view>
            <view class="preview-lines">
              <view class="preview-line w1" :style="{ background: theme.colors.textMuted, opacity: .5 }"></view>
              <view class="preview-line w2" :style="{ background: theme.colors.border }"></view>
              <view class="preview-line w3" :style="{ background: theme.colors.border }"></view>
            </view>
          </view>
        </view>
        <view class="theme-option-footer"><view><text class="theme-name">{{ theme.name }}</text><text class="theme-description">{{ theme.description }}</text></view><text v-if="themeStore.id === theme.id" class="theme-check">✓</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { THEMES, themeStore } from '../../stores/theme'

function selectTheme(id) {
  if (themeStore.id === id) return
  themeStore.setTheme(id)
  uni.showToast({ title: `已切换为${themeStore.currentTheme.name}`, icon: 'none' })
}
</script>

<style scoped>
.theme-page { min-height: 100vh; padding: 32rpx 24rpx calc(48rpx + env(safe-area-inset-bottom)); color: var(--theme-text); background: var(--theme-page-bg); box-sizing: border-box; }
.theme-intro { margin: 8rpx 8rpx 28rpx; }
.theme-intro-title,.theme-intro-description { display: block; }
.theme-intro-title { color: var(--theme-text); font-size: 40rpx; font-weight: 700; }
.theme-intro-description { margin-top: 12rpx; color: var(--theme-text-secondary); font-size: 25rpx; line-height: 1.6; }
.current-theme-card { display: flex; align-items: center; gap: 18rpx; margin-bottom: 28rpx; padding: 24rpx; border-radius: 24rpx; color: #fff; background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-end)); box-shadow: 0 12rpx 28rpx var(--theme-primary-shadow); }
.current-theme-mark { display: flex; align-items: center; justify-content: center; width: 56rpx; height: 56rpx; border-radius: 50%; color: var(--theme-primary); background: #fff; font-size: 30rpx; font-weight: 700; }
.current-theme-label,.current-theme-name { display: block; }
.current-theme-label { color: rgba(255,255,255,.76); font-size: 22rpx; }
.current-theme-name { margin-top: 5rpx; font-size: 31rpx; font-weight: 600; }
.theme-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20rpx; }
.theme-option { overflow: hidden; border: 3rpx solid transparent; border-radius: var(--theme-radius-card, 24rpx); background: var(--theme-surface); box-shadow: 0 8rpx 24rpx rgba(36, 58, 99, .06); box-sizing: border-box; }
.theme-option.selected { border-color: var(--theme-primary); box-shadow: 0 10rpx 26rpx var(--theme-primary-shadow); }
.theme-option:active { transform: scale(.98); }
.theme-preview { position: relative; overflow: hidden; width: 100%; height: 190rpx; }
.preview-band { position: absolute; top: 0; right: 0; left: 0; height: 66rpx; border-radius: 0 0 24rpx 24rpx; }
.preview-card { position: absolute; right: 18rpx; bottom: 14rpx; left: 18rpx; display: flex; align-items: center; gap: 16rpx; height: 116rpx; padding: 0 16rpx; border-radius: 16rpx; }
.preview-chip { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 10rpx; flex-shrink: 0; width: 118rpx; height: 76rpx; padding-left: 14rpx; border-radius: 12rpx; }
.preview-dot { width: 14rpx; height: 14rpx; border-radius: 50%; }
.preview-slash { width: 56rpx; height: 10rpx; border-radius: 5rpx; }
.preview-lines { display: flex; flex: 1; flex-direction: column; gap: 12rpx; }
.preview-line { height: 12rpx; border-radius: 6rpx; }
.preview-line.w1 { width: 86%; }
.preview-line.w2 { width: 62%; }
.preview-line.w3 { width: 74%; }
.theme-option-footer { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; min-height: 96rpx; padding: 15rpx 18rpx; box-sizing: border-box; }
.theme-name,.theme-description { display: block; }
.theme-name { color: var(--theme-text-strong); font-size: 26rpx; font-weight: 600; }
.theme-description { overflow: hidden; max-width: 210rpx; margin-top: 6rpx; color: var(--theme-text-muted); font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.theme-check { display: flex; align-items: center; justify-content: center; flex: 0 0 34rpx; width: 34rpx; height: 34rpx; border-radius: 50%; color: #fff; background: var(--theme-primary); font-size: 21rpx; }
</style>
