<template>
  <view :class="['security-page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="card category-entry" @click="goChangePassword"><view><text class="entry-title">修改密码</text><text class="entry-subtitle">修改后所有设备需重新登录</text></view><text class="entry-arrow">›</text></view>
    <view class="card category-entry" @click="goBindEmail"><view><text class="entry-title">绑定邮箱</text><text class="entry-subtitle">{{ boundEmailSubtitle }}</text></view><text class="entry-arrow">›</text></view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'

const currentEmail = ref('')

const boundEmailSubtitle = computed(() => (currentEmail.value ? `当前绑定：${currentEmail.value}` : '未绑定，绑定后可用于登录和找回密码'))

onShow(load)
async function load() {
  try {
    const profile = await appApi.getMe()
    authStore.setProfile(profile)
    currentEmail.value = profile.email || ''
  } catch (error) { showRequestError(error) }
}

function goChangePassword() { uni.navigateTo({ url: '/pages/profile/change-password' }) }
function goBindEmail() {
  uni.navigateTo({ url: currentEmail.value ? '/pages/profile/verify-old-email' : '/pages/profile/bind-email' })
}
</script>

<style scoped>
.security-page { min-height: 100vh; padding: 24rpx 0 60rpx; color: var(--theme-text); background: var(--theme-page-bg); box-sizing: border-box; }
.category-entry { display: flex; align-items: center; justify-content: space-between; }
.entry-title { color: var(--theme-text-strong); font-size: 30rpx; font-weight: 500; }
.entry-subtitle { display: block; margin-top: 10rpx; color: var(--theme-text-muted); font-size: 23rpx; }
.entry-arrow { color: var(--theme-text-muted); font-size: 40rpx; }
</style>
