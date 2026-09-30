<template>
  <view :class="['bind-email-page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="card">
      <view class="email-head">
        <text class="email-title">{{ rebind ? '第 2 步 · 绑定新邮箱' : '绑定邮箱' }}</text>
        <text class="email-current">当前：{{ currentEmail || '未绑定' }}</text>
      </view>
      <view class="form-item">
        <text class="form-label">新邮箱</text>
        <input v-model.trim="email" class="form-input" type="email" :maxlength="255" placeholder="请输入新邮箱地址" placeholder-class="form-placeholder" />
      </view>
      <view class="form-item">
        <text class="form-label">验证码</text>
        <input v-model="code" class="form-input" type="number" :maxlength="6" placeholder="6 位邮箱验证码" placeholder-class="form-placeholder" />
        <button class="send-button" :disabled="countdown > 0 || sendingCode" @click="sendCode">{{ codeButtonText }}</button>
      </view>
      <button class="primary-button confirm" :loading="saving" @click="submit">确认绑定</button>
      <text class="form-tip">绑定需要通过新邮箱的验证码校验；邮箱可用于登录和找回密码。</text>
    </view>
  </view>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'

const currentEmail = ref('')
const ticket = ref('')
const email = ref('')
const code = ref('')
const sendingCode = ref(false)
const saving = ref(false)
const countdown = ref(0)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
let countdownTimer = null

const rebind = computed(() => Boolean(currentEmail.value))
const codeButtonText = computed(() => (countdown.value > 0 ? `${countdown.value}s 后重发` : '获取验证码'))

onLoad((options) => {
  ticket.value = options?.ticket || ''
})

onShow(load)
onUnmounted(stopCountdown)

async function load() {
  try {
    const profile = await appApi.getMe()
    authStore.setProfile(profile)
    currentEmail.value = profile.email || ''
    // 换绑必须持有第一步签发的票据；直达本页且无票据时退回验证页。
    if (currentEmail.value && !ticket.value) {
      uni.redirectTo({ url: '/pages/profile/verify-old-email' })
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
  if (!EMAIL_PATTERN.test(email.value)) return uni.showToast({ title: '请输入正确的新邮箱地址', icon: 'none' })
  sendingCode.value = true
  try {
    await appApi.sendBindEmailCode({ email: email.value })
    uni.showToast({ title: '验证码已发送，请查收邮件', icon: 'none' })
    startCountdown(60)
  } catch (error) {
    showRequestError(error)
  } finally {
    sendingCode.value = false
  }
}

async function submit() {
  if (!EMAIL_PATTERN.test(email.value)) return uni.showToast({ title: '请输入正确的新邮箱地址', icon: 'none' })
  if (!/^\d{6}$/.test(code.value)) return uni.showToast({ title: '请输入 6 位邮箱验证码', icon: 'none' })
  saving.value = true
  try {
    await appApi.bindEmail({
      email: email.value,
      code: code.value,
      rebindTicket: rebind.value ? ticket.value : undefined
    })
    const profile = authStore.profile
    if (profile) authStore.setProfile({ ...profile, email: email.value })
    uni.showToast({ title: rebind.value ? '邮箱已换绑' : '邮箱已绑定', icon: 'success' })
    // 返回账号安全页：换绑路径多一层验证页，需要多退一层。
    setTimeout(() => uni.navigateBack({ delta: rebind.value ? 2 : 1 }), 600)
  } catch (error) {
    showRequestError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bind-email-page { min-height: 100vh; padding: 24rpx 0 60rpx; color: var(--theme-text); background: var(--theme-page-bg); box-sizing: border-box; }
.email-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20rpx; border-bottom: 1rpx solid var(--theme-border); }
.email-title { color: var(--theme-text-strong); font-size: 30rpx; font-weight: 500; }
.email-current { color: var(--theme-text-muted); font-size: 23rpx; }
.form-item { display: flex; align-items: center; gap: 20rpx; padding: 26rpx 4rpx; }
.form-item + .form-item { border-top: 1rpx solid var(--theme-border); }
.form-label { flex: 0 0 120rpx; color: var(--theme-text-secondary); font-size: 27rpx; }
.form-input { flex: 1; min-width: 0; color: var(--theme-text-strong); font-size: 28rpx; text-align: right; }
.form-placeholder { color: var(--theme-text-muted); }
.send-button { flex: 0 0 auto; margin: 0; height: 72rpx; line-height: 72rpx; padding: 0 22rpx; font-size: 24rpx; color: var(--theme-primary); background: var(--theme-primary-soft); }
.send-button[disabled] { color: var(--theme-text-muted); background: var(--theme-border); }
.confirm { margin-top: 30rpx; height: 84rpx; line-height: 84rpx; }
.form-tip { display: block; margin-top: 20rpx; color: var(--theme-text-muted); font-size: 22rpx; line-height: 1.6; text-align: center; }
</style>
