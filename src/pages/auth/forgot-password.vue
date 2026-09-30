<template>
  <view class="auth-page">
    <view class="hero"><text class="brand">找回密码</text><text class="subtitle">第 1 步 · 通过注册邮箱验证身份</text></view>
    <view class="form-card">
      <input v-model.trim="form.email" class="input" type="email" placeholder="注册邮箱" maxlength="255" confirm-type="next" />
      <view class="code-row form-space">
        <input v-model="form.code" class="input code-input" type="number" placeholder="邮箱验证码" maxlength="6" confirm-type="go" @confirm="submit" />
        <button class="send-button" :disabled="countdown > 0 || sendingCode" @click="sendCode">{{ codeButtonText }}</button>
      </view>
      <button class="primary-button submit" :loading="verifying" @click="submit">下一步</button>
      <view class="footer-text">想起来了？<text class="link" @click="goBack">返回登录</text></view>
    </view>
  </view>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'

const form = reactive({ email: '', code: '' })
const verifying = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
let countdownTimer = null

const codeButtonText = computed(() => (countdown.value > 0 ? `${countdown.value}s 后重发` : '获取验证码'))

onUnmounted(stopCountdown)

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
  if (!EMAIL_PATTERN.test(form.email)) return uni.showToast({ title: '请输入正确的邮箱地址', icon: 'none' })
  sendingCode.value = true
  try {
    await appApi.sendEmailCode({ purpose: 'RESET_PASSWORD', email: form.email })
    // 防枚举：无论邮箱是否注册，响应一致；未注册邮箱不会真的收到邮件。
    uni.showToast({ title: '若该邮箱已注册，验证码将发送至邮箱', icon: 'none' })
    startCountdown(60)
  } catch (error) {
    showRequestError(error)
  } finally {
    sendingCode.value = false
  }
}

async function submit() {
  if (!EMAIL_PATTERN.test(form.email)) return uni.showToast({ title: '请输入正确的邮箱地址', icon: 'none' })
  if (!/^\d{6}$/.test(form.code)) return uni.showToast({ title: '请输入 6 位邮箱验证码', icon: 'none' })
  verifying.value = true
  try {
    const result = await appApi.verifyResetEmail({ email: form.email, code: form.code })
    // 验证通过签发一次性票据，第二步凭票设置新密码。
    uni.navigateTo({ url: `/pages/auth/reset-password?ticket=${result.ticket}` })
  } catch (error) {
    showRequestError(error)
  } finally {
    verifying.value = false
  }
}

function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/auth/login' }) }) }
</script>

<style scoped>
.auth-page { min-height: 100vh; padding: 132rpx 48rpx 48rpx; background: linear-gradient(160deg, #e8f2ff 0%, #f5f7fb 52%, #fff 100%); }
.hero { margin-bottom: 72rpx; }
.brand { display: block; color: #1158b8; font-size: 58rpx; font-weight: 700; }
.subtitle { display: block; margin-top: 18rpx; color: #60708a; font-size: 28rpx; }
.form-card { padding: 44rpx 36rpx; border-radius: 32rpx; background: #fff; box-shadow: 0 20rpx 60rpx rgba(26, 84, 164, .12); }
.form-space { margin-top: 22rpx; }
.code-row { display: flex; align-items: center; gap: 18rpx; }
.code-input { flex: 1; min-width: 0; }
.send-button { flex: 0 0 auto; margin: 0; height: 88rpx; line-height: 88rpx; padding: 0 26rpx; font-size: 26rpx; color: #1677ff; background: #eaf3ff; }
.send-button[disabled] { color: #98a2b3; background: #f2f4f7; }
.submit { margin-top: 42rpx; height: 92rpx; line-height: 92rpx; }
.footer-text { margin-top: 38rpx; color: #7c8799; font-size: 26rpx; text-align: center; }
.link { padding: 10rpx 4rpx; color: #1677ff; }
.link:active { opacity: .6; }
</style>
