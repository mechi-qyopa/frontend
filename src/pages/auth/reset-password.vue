<template>
  <view class="auth-page">
    <view class="auth-hero"><text class="brand">设置新密码</text><text class="subtitle">第 2 步 · 邮箱验证已通过</text></view>
    <view class="form-card">
      <input v-model="form.password" class="input" placeholder="新密码（至少 8 位）" password maxlength="72" confirm-type="next" />
      <input v-model="confirmPassword" class="input form-space" placeholder="确认新密码" password maxlength="72" confirm-type="go" @confirm="submit" />
      <button class="primary-button submit" :loading="submitting" @click="submit">重置密码</button>
      <view class="footer-text">票据 10 分钟内有效，过期请重新验证邮箱。</view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'

const form = reactive({ password: '' })
const confirmPassword = ref('')
const submitting = ref(false)
const ticket = ref('')

onLoad((options) => {
  ticket.value = options.ticket || ''
  if (!ticket.value) {
    // 无票据直达时回到第一步重新验证邮箱。
    uni.redirectTo({ url: '/pages/auth/forgot-password' })
  }
})

async function submit() {
  if (form.password.length < 8) return uni.showToast({ title: '密码至少 8 位', icon: 'none' })
  if (form.password !== confirmPassword.value) return uni.showToast({ title: '两次密码不一致', icon: 'none' })
  submitting.value = true
  try {
    await appApi.resetPassword({ ticket: ticket.value, password: form.password })
    uni.showToast({ title: '密码已重置，请重新登录', icon: 'success' })
    setTimeout(() => uni.reLaunch({ url: '/pages/auth/login' }), 600)
  } catch (error) {
    showRequestError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.auth-page { min-height: 100vh; padding: 132rpx 48rpx 48rpx; background: linear-gradient(160deg, #e8f2ff 0%, #f5f7fb 52%, #fff 100%); }
.auth-hero { margin-bottom: 72rpx; }
.brand { display: block; color: #1158b8; font-size: 58rpx; font-weight: 700; }
.subtitle { display: block; margin-top: 18rpx; color: #60708a; font-size: 28rpx; }
.form-card { padding: 44rpx 36rpx; border-radius: 32rpx; background: #fff; box-shadow: 0 20rpx 60rpx rgba(26, 84, 164, .12); }
.form-space { margin-top: 22rpx; }
.submit { margin-top: 42rpx; height: 92rpx; line-height: 92rpx; }
.footer-text { margin-top: 38rpx; color: #7c8799; font-size: 26rpx; text-align: center; }
</style>
