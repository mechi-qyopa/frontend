<template>
  <view class="auth-page">
    <view class="hero"><text class="brand">创建账号</text><text class="subtitle">开始你的轻松记账之旅</text></view>
    <view class="form-card">
      <input v-model.trim="form.username" class="input" placeholder="用户名（3-32 位字母、数字或下划线）" maxlength="32" />
      <input v-model="form.phone" class="input form-space" type="number" placeholder="手机号" maxlength="11" />
      <input v-model="form.password" class="input form-space" placeholder="密码（至少 8 位）" password maxlength="72" />
      <input v-model="confirmPassword" class="input form-space" placeholder="确认密码" password maxlength="72" />
      <button class="primary-button submit" :loading="submitting" @click="submit">注册</button>
      <view class="footer-text">已有账号？<text class="link" @click="goLogin">返回登录</text></view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'

const form = reactive({ username: '', phone: '', password: '' })
const confirmPassword = ref('')
const submitting = ref(false)

async function submit() {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(form.username)) return uni.showToast({ title: '用户名格式不正确', icon: 'none' })
  if (!/^1\d{10}$/.test(form.phone)) return uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
  if (form.password.length < 8) return uni.showToast({ title: '密码至少 8 位', icon: 'none' })
  if (form.password !== confirmPassword.value) return uni.showToast({ title: '两次密码不一致', icon: 'none' })
  submitting.value = true
  try {
    await appApi.register(form)
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
.hero { margin-bottom: 62rpx; }
.brand { display: block; color: #1158b8; font-size: 58rpx; font-weight: 700; }
.subtitle { display: block; margin-top: 18rpx; color: #60708a; font-size: 28rpx; }
.form-card { padding: 44rpx 36rpx; border-radius: 32rpx; background: #fff; box-shadow: 0 20rpx 60rpx rgba(26, 84, 164, .12); }
.form-space { margin-top: 22rpx; }
.submit { margin-top: 42rpx; height: 92rpx; line-height: 92rpx; }
.footer-text { margin-top: 38rpx; color: #7c8799; font-size: 26rpx; text-align: center; }
.link { color: #1677ff; }
</style>
