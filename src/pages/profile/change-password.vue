<template>
  <view :class="['change-password-page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="card form-card">
      <view class="form-item">
        <text class="form-label">旧密码</text>
        <input v-model="form.oldPassword" class="form-input" password :maxlength="72" placeholder="请输入当前密码" placeholder-class="form-placeholder" />
      </view>
      <view v-if="boundEmail" class="form-item email-item">
        <view class="email-main">
          <text class="form-label">当前邮箱</text>
          <text class="form-value">{{ boundEmail }}</text>
        </view>
        <button class="send-button" :disabled="countdown > 0 || sendingCode" @click="sendCode">{{ codeButtonText }}</button>
      </view>
      <view v-if="boundEmail" class="form-item">
        <text class="form-label">邮箱验证码</text>
        <input v-model="form.emailCode" class="form-input" type="number" :maxlength="6" placeholder="6 位验证码" placeholder-class="form-placeholder" />
      </view>
      <view class="form-item">
        <text class="form-label">新密码</text>
        <input v-model="form.newPassword" class="form-input" password :maxlength="72" placeholder="至少 8 位" placeholder-class="form-placeholder" />
      </view>
      <view class="form-item">
        <text class="form-label">确认新密码</text>
        <input v-model="confirmPassword" class="form-input" password :maxlength="72" placeholder="再次输入新密码" placeholder-class="form-placeholder" />
      </view>
    </view>
    <button class="primary-button save" :loading="saving" @click="submit">确认修改</button>
    <text class="form-tip">{{ boundEmail ? '修改需要通过旧密码与绑定邮箱验证码双重校验，成功后所有设备重新登录。' : '绑定邮箱后，修改密码还需邮箱验证码校验。' }}</text>
  </view>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { themeStore } from '../../stores/theme'
import { redirectToLogin, showRequestError } from '../../utils/request'

const boundEmail = ref('')
const form = reactive({ oldPassword: '', emailCode: '', newPassword: '' })
const confirmPassword = ref('')
const saving = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
let countdownTimer = null

const codeButtonText = computed(() => (countdown.value > 0 ? `${countdown.value}s 后重发` : '获取验证码'))

onShow(load)
onUnmounted(stopCountdown)

async function load() {
  try {
    const profile = await appApi.getMe()
    boundEmail.value = profile.email || ''
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
    await appApi.sendChangePasswordCode()
    uni.showToast({ title: '验证码已发送，请查收邮件', icon: 'none' })
    startCountdown(60)
  } catch (error) {
    showRequestError(error)
  } finally {
    sendingCode.value = false
  }
}

async function submit() {
  if (!form.oldPassword) return uni.showToast({ title: '请输入旧密码', icon: 'none' })
  if (boundEmail.value && !/^\d{6}$/.test(form.emailCode)) return uni.showToast({ title: '请输入 6 位邮箱验证码', icon: 'none' })
  if (form.newPassword.length < 8) return uni.showToast({ title: '新密码至少 8 位', icon: 'none' })
  if (form.newPassword !== confirmPassword.value) return uni.showToast({ title: '两次输入的新密码不一致', icon: 'none' })
  if (form.newPassword === form.oldPassword) return uni.showToast({ title: '新密码不能与旧密码相同', icon: 'none' })
  saving.value = true
  try {
    await appApi.changePassword({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
      emailCode: boundEmail.value ? form.emailCode : undefined
    })
    uni.showToast({ title: '密码已修改，请重新登录', icon: 'success' })
    // 全端失效：当前会话也已被服务端作废，回到登录页。
    setTimeout(() => redirectToLogin(), 600)
  } catch (error) {
    showRequestError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.change-password-page { min-height: 100vh; padding: 24rpx 0 60rpx; color: var(--theme-text); background: var(--theme-page-bg); box-sizing: border-box; }
.form-item { display: flex; align-items: center; gap: 20rpx; padding: 26rpx 4rpx; }
.form-item + .form-item { border-top: 1rpx solid var(--theme-border); }
.form-label { flex: 0 0 160rpx; color: var(--theme-text-secondary); font-size: 27rpx; }
.form-input { flex: 1; min-width: 0; color: var(--theme-text-strong); font-size: 28rpx; text-align: right; }
.form-placeholder { color: var(--theme-text-muted); }
/* 长邮箱两行展示：标签在上，邮箱占满剩余宽度自动换行，按钮独立右侧。 */
.email-item { align-items: center; }
.email-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.email-main .form-label { flex: none; }
.form-value { color: var(--theme-text-strong); font-size: 26rpx; word-break: break-all; line-height: 1.4; }
.send-button { flex: 0 0 auto; margin: 0; height: 72rpx; line-height: 72rpx; padding: 0 22rpx; font-size: 24rpx; color: var(--theme-primary); background: var(--theme-primary-soft); }
.send-button[disabled] { color: var(--theme-text-muted); background: var(--theme-border); }
.save { margin: 44rpx 24rpx 0; }
.form-tip { display: block; margin: 22rpx 44rpx 0; color: var(--theme-text-muted); font-size: 22rpx; line-height: 1.6; text-align: center; }
</style>
