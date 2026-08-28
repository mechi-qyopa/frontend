<template>
  <view :class="['info-page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="card head-card">
      <view class="avatar-trigger" @click="changeAvatar">
        <image v-if="avatar && !previewFailed" class="avatar" :src="avatar" mode="aspectFill" @error="previewFailed = true" />
        <view v-else class="avatar">{{ initial }}</view>
        <view class="avatar-badge">更换</view>
      </view>
      <view class="head-meta"><text class="head-username">{{ username || authStore.profile?.username || '用户' }}</text><text class="head-role">{{ roleText }}</text></view>
    </view>
    <view class="card form-card">
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input v-model="username" class="form-input" :maxlength="32" placeholder="3-32 位字母、数字或下划线" placeholder-class="form-placeholder" />
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input v-model="phone" class="form-input" type="number" :maxlength="11" placeholder="请输入 11 位手机号" placeholder-class="form-placeholder" />
      </view>
      <view class="form-item readonly">
        <text class="form-label">当前身份</text>
        <text class="form-value">{{ roleText }}</text>
      </view>
    </view>
    <button class="primary-button save" :loading="saving" @click="save">保存修改</button>
    <text class="form-tip">用户名与手机号被占用时无法保存，可修改后重试。</text>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'

const username = ref(''); const phone = ref(''); const avatar = ref('')
const saving = ref(false); const avatarUploading = ref(false); const previewFailed = ref(false)
const initial = computed(() => (username.value || authStore.profile?.username || '用').slice(0, 1).toUpperCase())
const roleText = computed(() => (authStore.profile?.role === 'ADMIN' ? '管理员' : '普通用户'))

onShow(load)
async function load() {
  try {
    const profile = await appApi.getMe()
    authStore.setProfile(profile)
    username.value = profile.username || ''
    phone.value = profile.phone || ''
    avatar.value = profile.avatar || ''
    previewFailed.value = false
  } catch (error) { showRequestError(error) }
}

async function changeAvatar() {
  if (avatarUploading.value) return
  try {
    const filePath = await new Promise((resolve, reject) => uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: ({ tempFilePaths }) => resolve(tempFilePaths[0]), fail: reject }))
    avatarUploading.value = true
    uni.showLoading({ title: '上传中' })
    const uploaded = await appApi.uploadImage(filePath)
    const profile = await appApi.updateMe({ avatar: uploaded })
    authStore.setProfile(profile)
    avatar.value = profile.avatar || ''
    previewFailed.value = false
    uni.hideLoading()
    uni.showToast({ title: '头像已更新', icon: 'success' })
  } catch (error) {
    uni.hideLoading()
    if (!String(error?.errMsg || error?.message || '').includes('cancel')) showRequestError(error)
  } finally { avatarUploading.value = false }
}

async function save() {
  if (saving.value) return
  const name = username.value.trim().toLowerCase()
  const mobile = phone.value.trim()
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) { uni.showToast({ title: '用户名需为 3-32 位字母、数字或下划线', icon: 'none' }); return }
  if (!/^1\d{10}$/.test(mobile)) { uni.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' }); return }
  saving.value = true
  try {
    const profile = await appApi.updateMe({ username: name, phone: mobile })
    authStore.setProfile(profile)
    username.value = profile.username || ''
    phone.value = profile.phone || ''
    uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (error) { showRequestError(error) } finally { saving.value = false }
}
</script>

<style scoped>
.info-page { min-height: 100vh; padding: 24rpx 0 60rpx; color: var(--theme-text); background: var(--theme-page-bg); box-sizing: border-box; }
.head-card { display: flex; align-items: center; gap: 28rpx; }
.avatar-trigger { position: relative; width: 128rpx; height: 128rpx; }
.avatar { display: flex; align-items: center; justify-content: center; width: 120rpx; height: 120rpx; overflow: hidden; border: 4rpx solid var(--theme-primary-soft); border-radius: 50%; background: var(--theme-primary-soft); color: var(--theme-primary); font-size: 48rpx; font-weight: 700; }
.avatar-badge { position: absolute; right: -6rpx; bottom: 0; padding: 4rpx 12rpx; border-radius: 16rpx; color: #fff; background: var(--theme-primary); font-size: 20rpx; line-height: 1.3; }
.head-username { display: block; color: var(--theme-text-strong); font-size: 34rpx; font-weight: 600; }
.head-role { display: inline-block; margin-top: 12rpx; padding: 5rpx 14rpx; border-radius: 12rpx; color: var(--theme-primary); background: var(--theme-primary-soft); font-size: 21rpx; }
.form-item { display: flex; align-items: center; gap: 24rpx; padding: 26rpx 4rpx; }
.form-item + .form-item { border-top: 1rpx solid var(--theme-border); }
.form-label { flex: 0 0 140rpx; color: var(--theme-text-secondary); font-size: 27rpx; }
.form-input { flex: 1; min-width: 0; color: var(--theme-text-strong); font-size: 28rpx; text-align: right; }
.form-placeholder { color: var(--theme-text-muted); }
.form-value { flex: 1; color: var(--theme-text-strong); font-size: 28rpx; text-align: right; }
.save { margin: 44rpx 24rpx 0; }
.form-tip { display: block; margin: 22rpx 44rpx 0; color: var(--theme-text-muted); font-size: 22rpx; line-height: 1.6; text-align: center; }
</style>
