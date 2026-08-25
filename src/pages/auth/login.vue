<template>
  <view class="auth-page">
    <view class="hero"><text class="brand">美记账</text><text class="subtitle">记录每一笔，掌控每一天</text></view>
    <view class="form-card">
      <text class="title">欢迎回来</text>
      <input v-model.trim="form.username" class="input" placeholder="用户名" maxlength="32" />
      <input v-model="form.password" class="input form-space" placeholder="密码" password maxlength="72" />
      <button class="primary-button submit" :loading="submitting" @click="submit">登录</button>
      <view class="footer-text">还没有账号？<text class="link" @click="goRegister">立即注册</text></view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { showRequestError } from '../../utils/request'

const form = reactive({ username: '', password: '' })
const submitting = ref(false)

onShow(() => {
  if (authStore.token) uni.switchTab({ url: '/pages/ledger/index' })
})

async function submit() {
  if (!form.username || !form.password) return uni.showToast({ title: '请输入用户名和密码', icon: 'none' })
  submitting.value = true
  try {
    const result = await appApi.login(form)
    authStore.setLogin(result.token, result.refreshToken, result.user)
    uni.switchTab({ url: '/pages/ledger/index' })
  } catch (error) {
    showRequestError(error)
  } finally {
    submitting.value = false
  }
}

function goRegister() { uni.navigateTo({ url: '/pages/auth/register' }) }
</script>

<style scoped>
.auth-page { min-height: 100vh; padding: 132rpx 48rpx 48rpx; background: linear-gradient(160deg, #e8f2ff 0%, #f5f7fb 52%, #fff 100%); }
.hero { margin-bottom: 82rpx; }
.brand { display: block; color: #1158b8; font-size: 64rpx; font-weight: 700; letter-spacing: 4rpx; }
.subtitle { display: block; margin-top: 18rpx; color: #60708a; font-size: 28rpx; }
.form-card { padding: 44rpx 36rpx; border-radius: 32rpx; background: #fff; box-shadow: 0 20rpx 60rpx rgba(26, 84, 164, .12); }
.title { display: block; margin-bottom: 40rpx; color: #1d2939; font-size: 42rpx; font-weight: 600; }
.form-space { margin-top: 24rpx; }
.submit { margin-top: 42rpx; height: 92rpx; line-height: 92rpx; }
.footer-text { margin-top: 38rpx; color: #7c8799; font-size: 26rpx; text-align: center; }
.link { color: #1677ff; }
</style>
