<template>
  <view class="auth-page">
    <view class="auth-hero"><text class="brand">创建账号</text><text class="subtitle">通过邮箱验证码完成注册</text></view>
    <view class="form-card">
      <view class="code-row">
        <input v-model.trim="form.email" class="input code-input" type="email" placeholder="邮箱地址" maxlength="255" confirm-type="next" />
        <button class="send-button" :disabled="countdown > 0 || sendingCode" @click="sendCode">{{ codeButtonText }}</button>
      </view>
      <input v-model="form.code" class="input form-space" type="number" placeholder="邮箱验证码" maxlength="6" confirm-type="next" />
      <input v-model="form.password" class="input form-space" placeholder="密码（至少 8 位）" password maxlength="72" confirm-type="next" />
      <input v-model="confirmPassword" class="input form-space" placeholder="确认密码" password maxlength="72" confirm-type="go" @confirm="submit" />
      <text class="mode-tip">用户名将根据邮箱自动生成，注册后可在个人信息中修改。</text>
      <button class="primary-button submit" :loading="submitting" @click="submit">注册</button>
      <view class="footer-text">已有账号？<text class="link" @click="goLogin">返回登录</text></view>
    </view>
  </view>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'

const form = reactive({ email: '', code: '', password: '' })
const confirmPassword = ref('')
const submitting = ref(false)
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
  if (!EMAIL_PATTERN.test(form.email)) return uni.showToast({ title: '请先填写正确的邮箱地址', icon: 'none' })
  sendingCode.value = true
  try {
    await appApi.sendEmailCode({ purpose: 'REGISTER', email: form.email })
    uni.showToast({ title: '验证码已发送，请查收邮件', icon: 'none' })
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
  if (form.password.length < 8) return uni.showToast({ title: '密码至少 8 位', icon: 'none' })
  if (form.password !== confirmPassword.value) return uni.showToast({ title: '两次密码不一致', icon: 'none' })
  submitting.value = true
  try {
    await appApi.registerByEmail({ email: form.email, code: form.code, password: form.password })
    uni.showToast({ title: '注册成功，请登录', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (error) {
    showRequestError(error)
  } finally {
    submitting.value = false
  }
}

function goLogin() { uni.navigateBack() }
</script>

<style scoped>
.auth-page { min-height: 100vh; padding: 112rpx 48rpx 48rpx; background: linear-gradient(160deg, #e8f2ff 0%, #f5f7fb 52%, #fff 100%); }
.auth-hero { margin-bottom: 62rpx; }
.brand { display: block; color: #1158b8; font-size: 58rpx; font-weight: 700; }
.subtitle { display: block; margin-top: 18rpx; color: #60708a; font-size: 28rpx; }
.form-card { padding: 44rpx 36rpx; border-radius: 32rpx; background: #fff; box-shadow: 0 20rpx 60rpx rgba(26, 84, 164, .12); }
.form-space { margin-top: 22rpx; }
.code-row { display: flex; align-items: center; gap: 18rpx; }
.code-input { flex: 1; min-width: 0; }
.send-button { flex: 0 0 auto; margin: 0; height: 88rpx; line-height: 88rpx; padding: 0 26rpx; font-size: 26rpx; color: #1677ff; background: #eaf3ff; }
.send-button[disabled] { color: #98a2b3; background: #f2f4f7; }
.mode-tip { display: block; margin-top: 20rpx; color: #98a2b3; font-size: 23rpx; line-height: 1.5; }
.submit { margin-top: 42rpx; height: 92rpx; line-height: 92rpx; }
.footer-text { margin-top: 38rpx; color: #7c8799; font-size: 26rpx; text-align: center; }
.link { padding: 10rpx 4rpx; color: #1677ff; }
.link:active { opacity: .6; }
</style>
