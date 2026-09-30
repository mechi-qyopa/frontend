<template>
  <view :class="['verify-old-email-page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="card">
      <view class="email-head">
        <text class="email-title">第 1 步 · 验证原邮箱</text>
        <text class="email-current">{{ currentEmail }}</text>
      </view>
      <view class="form-item">
        <text class="form-label">验证码</text>
        <input v-model="code" class="form-input" type="number" :maxlength="6" placeholder="6 位邮箱验证码" placeholder-class="form-placeholder" />
        <button class="send-button" :disabled="countdown > 0 || sendingCode" @click="sendCode">{{ codeButtonText }}</button>
      </view>
      <button class="primary-button confirm" :loading="verifying" @click="submit">下一步</button>
      <text class="form-tip">为保护账号安全，换绑前需要先验证当前绑定的邮箱。</text>
    </view>
  </view>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'

const currentEmail = ref('')
const code = ref('')
const sendingCode = ref(false)
const verifying = ref(false)
const countdown = ref(0)
let countdownTimer = null

const codeButtonText = computed(() => (countdown.value > 0 ? `${countdown.value}s 后重发` : '获取验证码'))

onShow(load)
onUnmounted(stopCountdown)

async function load() {
  try {
    const profile = await appApi.getMe()
    authStore.setProfile(profile)
    currentEmail.value = profile.email || ''
    if (!currentEmail.value) {
      // 未绑定邮箱不需要验证原邮箱，直接进入绑定页。
      uni.redirectTo({ url: '/pages/profile/bind-email' })
    }
  } catch (error) { showRequestError(error) }
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

function startCountdown(seconds) {
  countdown.value = seconds
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) stopCountdown()
  }, 1000)
}

async function sendCode() {
  sendingCode.value = true
  try {
    await appApi.sendOldEmailCode()
    uni.showToast({ title: '验证码已发送至原邮箱', icon: 'none' })
    startCountdown(60)
  } catch (error) {
    showRequestError(error)
  } finally {
    sendingCode.value = false
  }
}

async function submit() {
  if (!/^\d{6}$/.test(code.value)) return uni.showToast({ title: '请输入 6 位邮箱验证码', icon: 'none' })
  verifying.value = true
  try {
    const result = await appApi.verifyOldEmail({ code: code.value })
    uni.navigateTo({ url: `/pages/profile/bind-email?ticket=${result.ticket}` })
  } catch (error) {
    showRequestError(error)
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped>
.verify-old-email-page { min-height: 100vh; padding: 24rpx 0 60rpx; color: var(--theme-text); background: var(--theme-page-bg); box-sizing: border-box; }
.email-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20rpx; border-bottom: 1rpx solid var(--theme-border); }
.email-title { color: var(--theme-text-strong); font-size: 30rpx; font-weight: 500; }
.email-current { flex: 1; min-width: 0; margin-left: 20rpx; color: var(--theme-text-muted); font-size: 23rpx; text-align: right; word-break: break-all; line-height: 1.4; }
.form-item { display: flex; align-items: center; gap: 20rpx; padding: 26rpx 4rpx; }
.form-label { flex: 0 0 120rpx; color: var(--theme-text-secondary); font-size: 27rpx; }
.form-input { flex: 1; min-width: 0; color: var(--theme-text-strong); font-size: 28rpx; text-align: right; }
.form-placeholder { color: var(--theme-text-muted); }
.send-button { flex: 0 0 auto; margin: 0; height: 72rpx; line-height: 72rpx; padding: 0 22rpx; font-size: 24rpx; color: var(--theme-primary); background: var(--theme-primary-soft); }
.send-button[disabled] { color: var(--theme-text-muted); background: var(--theme-border); }
.confirm { margin-top: 30rpx; height: 84rpx; line-height: 84rpx; }
.form-tip { display: block; margin-top: 20rpx; color: var(--theme-text-muted); font-size: 22rpx; line-height: 1.6; text-align: center; }
</style>
