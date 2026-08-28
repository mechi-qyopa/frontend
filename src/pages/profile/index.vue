<template>
  <view :class="['profile-page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="profile-head" :style="profileHeadStyle">
      <view class="avatar-trigger" @click="openAvatarDialog">
        <image v-if="avatar && !previewFailed" class="avatar avatar-image" :src="avatar" mode="aspectFill" @error="previewFailed = true" />
        <view v-else class="avatar">{{ initial }}</view>
        <view class="avatar-badge">编辑</view>
      </view>
      <view><text class="username">{{ authStore.profile?.username || '用户' }}</text><text class="phone">{{ authStore.profile?.phone || '' }}</text></view>
    </view>
    <view class="card activity-card">
      <text class="activity-title">记账足迹</text>
      <view class="activity-stats">
        <view class="activity-stat"><text class="activity-value">{{ activityStats.totalBookkeepingDays ?? '--' }}</text><text class="activity-label">记账天数</text></view>
        <view class="activity-stat"><text class="activity-value">{{ activityStats.totalTransactionCount ?? '--' }}</text><text class="activity-label">记账笔数</text></view>
        <view class="activity-stat"><text class="activity-value">{{ activityStats.currentStreakDays ?? '--' }}</text><text class="activity-label">连续记账天数</text></view>
      </view>
    </view>
    <view class="card category-entry" @click="goProfileInfo"><view><text class="entry-title">个人信息</text><text class="entry-subtitle">查看与修改头像、用户名、手机号</text></view><text class="entry-arrow">›</text></view>
    <view class="card category-entry" @click="goCategories"><view><text class="entry-title">分类管理</text><text class="entry-subtitle">管理收入与支出分类</text></view><text class="entry-arrow">›</text></view>
    <view class="card category-entry theme-entry" @click="goThemeSettings"><view><text class="entry-title">主题外观</text><text class="entry-subtitle">当前使用：{{ themeStore.currentTheme.name }}</text></view><view class="entry-right"><text class="theme-current">已启用</text><text class="entry-arrow">›</text></view></view>
    <button class="logout" @click="logout">退出登录</button>

    <view v-if="avatarDialogVisible" class="avatar-mask" @click.self="closeAvatarDialog">
      <view class="avatar-dialog">
        <view class="dialog-handle" />
        <text class="dialog-title">头像</text>
        <image v-if="avatar && !previewFailed" class="dialog-avatar" :src="avatar" mode="aspectFill" @error="previewFailed = true" />
        <view v-else class="dialog-avatar dialog-avatar-placeholder">{{ initial }}</view>
        <text class="dialog-tip">{{ hasChanges ? '新头像已上传，确认后将同步到个人资料。' : '选择一张照片，裁剪后更换头像。' }}</text>
        <button class="change-avatar" :loading="uploading" @click="startAvatarChange">更换头像</button>
        <button v-if="hasChanges" class="primary-button confirm-avatar" :loading="saving" @click="save">确认使用此头像</button>
        <button class="cancel-avatar" @click="closeAvatarDialog">取消</button>
      </view>
    </view>

    <view v-if="cropping" class="crop-mask">
      <view class="crop-dialog">
        <text class="crop-title">裁剪头像</text><text class="crop-tip">拖动图片调整位置，使用按钮调整缩放</text>
        <view class="crop-window" :style="cropWindowStyle" @touchstart="startDrag" @touchmove.stop.prevent="moveDrag"><image class="crop-image" :src="cropSource" :style="cropImageStyle" mode="scaleToFill" /></view>
        <view class="crop-tools"><button class="crop-control" :disabled="zoom <= 1" @click="changeZoom(-0.1)">缩小</button><text>{{ Math.round(zoom * 100) }}%</text><button class="crop-control" :disabled="zoom >= 3" @click="changeZoom(0.1)">放大</button></view>
        <view class="crop-actions"><button class="crop-cancel" @click="cancelCrop">取消</button><button class="primary-button crop-confirm" :loading="uploading" @click="confirmCrop">完成裁剪</button></view>
        <canvas canvas-id="avatar-crop-canvas" class="crop-canvas" :width="600" :height="600" />
      </view>
    </view>

    <!-- #ifdef APP-PLUS -->
    <custom-tab-bar />
    <!-- #endif -->
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'
// #ifdef APP-PLUS
import CustomTabBar from '../../custom-tab-bar/index.vue'
// #endif

const avatar = ref(''); const savedAvatar = ref(''); const uploading = ref(false); const saving = ref(false); const previewFailed = ref(false); const avatarDialogVisible = ref(false); const cropping = ref(false); const cropSource = ref(''); const cropSize = ref(280); const sourceWidth = ref(0); const sourceHeight = ref(0); const baseScale = ref(1); const zoom = ref(1); const offsetX = ref(0); const offsetY = ref(0); const dragStart = ref(null)
const activityStats = ref({ totalBookkeepingDays: null, totalTransactionCount: null, currentStreakDays: null })
const initial = computed(() => (authStore.profile?.username || '用').slice(0, 1).toUpperCase())
const hasChanges = computed(() => avatar.value !== savedAvatar.value)
const profileHeadStyle = computed(() => ({ background: `linear-gradient(135deg, ${themeStore.currentTheme.colors.primary}, ${themeStore.currentTheme.colors.primaryEnd})` }))
const imageWidth = computed(() => sourceWidth.value * baseScale.value * zoom.value); const imageHeight = computed(() => sourceHeight.value * baseScale.value * zoom.value); const imageLeft = computed(() => (cropSize.value - imageWidth.value) / 2 + offsetX.value); const imageTop = computed(() => (cropSize.value - imageHeight.value) / 2 + offsetY.value)
const cropWindowStyle = computed(() => ({ width: `${cropSize.value}px`, height: `${cropSize.value}px` })); const cropImageStyle = computed(() => ({ width: `${imageWidth.value}px`, height: `${imageHeight.value}px`, transform: `translate(${imageLeft.value}px, ${imageTop.value}px)` }))

onShow(load)
async function load() {
  const [profileResult, activityStatsResult] = await Promise.allSettled([
    appApi.getMe(),
    appApi.getTransactionActivityStats()
  ])
  if (profileResult.status === 'fulfilled') {
    const profile = profileResult.value
    authStore.setProfile(profile)
    avatar.value = profile.avatar || ''
    savedAvatar.value = avatar.value
    previewFailed.value = false
  } else {
    showRequestError(profileResult.reason)
  }
  if (activityStatsResult.status === 'fulfilled') activityStats.value = activityStatsResult.value
}
function goThemeSettings() { uni.navigateTo({ url: '/pages/profile/theme-settings' }) }
function goProfileInfo() { uni.navigateTo({ url: '/pages/profile/info' }) }
function openAvatarDialog() { previewFailed.value = false; avatarDialogVisible.value = true }
function closeAvatarDialog() { avatarDialogVisible.value = false }
function goCategories() { uni.navigateTo({ url: '/pages/ledger/categories' }) }
function chooseImage() { return new Promise((resolve, reject) => uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: ({ tempFilePaths }) => resolve(tempFilePaths[0]), fail: reject })) }
function getImageInfo(src) { return new Promise((resolve, reject) => uni.getImageInfo({ src, success: resolve, fail: reject })) }
async function startAvatarChange() { if (uploading.value || cropping.value) return; avatarDialogVisible.value = false; try { const filePath = await chooseImage(); const info = await getImageInfo(filePath); cropSource.value = filePath; sourceWidth.value = info.width; sourceHeight.value = info.height; cropSize.value = Math.round(uni.getSystemInfoSync().windowWidth * 0.76); baseScale.value = Math.max(cropSize.value / info.width, cropSize.value / info.height); zoom.value = 1; offsetX.value = 0; offsetY.value = 0; cropping.value = true } catch (error) { if (!String(error?.errMsg || error?.message || '').includes('cancel')) showRequestError(error) } }
function constrainOffset() { const horizontalLimit = Math.max(0, (imageWidth.value - cropSize.value) / 2); const verticalLimit = Math.max(0, (imageHeight.value - cropSize.value) / 2); offsetX.value = Math.min(horizontalLimit, Math.max(-horizontalLimit, offsetX.value)); offsetY.value = Math.min(verticalLimit, Math.max(-verticalLimit, offsetY.value)) }
function startDrag(event) { const touch = event.touches?.[0]; if (!touch) return; dragStart.value = { x: touch.clientX, y: touch.clientY, offsetX: offsetX.value, offsetY: offsetY.value } }
function moveDrag(event) { const touch = event.touches?.[0]; if (!touch || !dragStart.value) return; offsetX.value = dragStart.value.offsetX + touch.clientX - dragStart.value.x; offsetY.value = dragStart.value.offsetY + touch.clientY - dragStart.value.y; constrainOffset() }
function changeZoom(delta) { zoom.value = Math.min(3, Math.max(1, Number((zoom.value + delta).toFixed(1)))); constrainOffset() }
function canvasToTempFile() { const scale = 600 / cropSize.value; const context = uni.createCanvasContext('avatar-crop-canvas'); context.clearRect(0, 0, 600, 600); context.drawImage(cropSource.value, imageLeft.value * scale, imageTop.value * scale, imageWidth.value * scale, imageHeight.value * scale); return new Promise((resolve, reject) => context.draw(false, () => uni.canvasToTempFilePath({ canvasId: 'avatar-crop-canvas', destWidth: 600, destHeight: 600, quality: 0.9, success: ({ tempFilePath }) => resolve(tempFilePath), fail: reject }))) }
async function confirmCrop() { if (uploading.value) return; try { uploading.value = true; const filePath = await canvasToTempFile(); avatar.value = await appApi.uploadImage(filePath); previewFailed.value = false; cropping.value = false; avatarDialogVisible.value = true; uni.showToast({ title: '上传成功，请确认保存', icon: 'none' }) } catch (error) { showRequestError(error) } finally { uploading.value = false } }
function cancelCrop() { cropping.value = false; cropSource.value = ''; dragStart.value = null; avatarDialogVisible.value = true }
async function save() { if (!hasChanges.value || saving.value) return; saving.value = true; try { const profile = await appApi.updateMe({ avatar: avatar.value || null }); authStore.setProfile(profile); savedAvatar.value = profile.avatar || ''; avatar.value = savedAvatar.value; previewFailed.value = false; avatarDialogVisible.value = false; uni.showToast({ title: '头像已保存', icon: 'success' }) } catch (error) { showRequestError(error) } finally { saving.value = false } }
function logout() { uni.showModal({ title: '退出登录', content: '确定退出当前账号吗？', success: async ({ confirm }) => { if (!confirm) return; try { await appApi.logout() } catch { /* token 无效时仍清理本地状态 */ } finally { authStore.clear(); uni.reLaunch({ url: '/pages/auth/login' }) } } }) }
</script>

<style scoped>
.profile-page { min-height: 100vh; padding-bottom: calc(1rpx + var(--tab-bar-height, var(--window-bottom)) + env(safe-area-inset-bottom)); color: var(--theme-text); background: var(--theme-page-bg); }.profile-head { display: flex; align-items: center; gap: 24rpx; padding: calc(64rpx + var(--status-bar-height, 0px)) 40rpx 52rpx; color: #fff; }.avatar-trigger { position: relative; width: 116rpx; height: 116rpx; }.avatar { display: flex; align-items: center; justify-content: center; width: 108rpx; height: 108rpx; overflow: hidden; border: 4rpx solid rgba(255,255,255,.6); border-radius: 50%; background: rgba(255,255,255,.2); font-size: 44rpx; }.avatar-image { display: block; }.avatar-badge { position: absolute; right: -8rpx; bottom: -2rpx; padding: 4rpx 10rpx; border-radius: 16rpx; color: var(--theme-primary); background: var(--theme-surface); font-size: 20rpx; line-height: 1.3; }.username,.phone { display: block; }.username { font-size: 36rpx; font-weight: 600; }.phone { margin-top: 10rpx; color: rgba(255,255,255,.78); font-size: 25rpx; }.activity-card { padding: 28rpx 24rpx; }.activity-title { display: block; margin: 0 4rpx 24rpx; color: var(--theme-text-strong); font-size: 29rpx; font-weight: 600; }.activity-stats { display: flex; }.activity-stat { display: flex; flex: 1; flex-direction: column; align-items: center; gap: 10rpx; }.activity-stat + .activity-stat { border-left: 1rpx solid var(--theme-border); }.activity-value { color: var(--theme-primary); font-size: 38rpx; font-weight: 700; }.activity-label { color: var(--theme-text-muted); font-size: 22rpx; }.category-entry { display: flex; align-items: center; justify-content: space-between; color: var(--theme-text-secondary); }.category-entry { margin-top: 0; }.entry-title,.entry-subtitle { display: block; }.entry-title { color: var(--theme-text-strong); font-size: 29rpx; }.entry-subtitle { margin-top: 10rpx; color: var(--theme-text-muted); font-size: 23rpx; }.entry-right { display: flex; align-items: center; gap: 14rpx; }.entry-arrow { color: var(--theme-text-muted); font-size: 42rpx; }.theme-card { margin-top: 0; }.theme-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24rpx; }.theme-title,.theme-subtitle { display: block; }.theme-title { color: var(--theme-text-strong); font-size: 29rpx; font-weight: 600; }.theme-subtitle { margin-top: 8rpx; color: var(--theme-text-muted); font-size: 22rpx; }.theme-current { padding: 6rpx 12rpx; border-radius: 12rpx; color: var(--theme-primary); background: var(--theme-primary-soft); font-size: 21rpx; }.theme-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; }.theme-option { overflow: hidden; border: 2rpx solid transparent; border-radius: 20rpx; background: var(--theme-page-bg); box-sizing: border-box; }.theme-option.selected { border-color: var(--theme-primary); box-shadow: 0 8rpx 18rpx rgba(36, 58, 99, .16); }.theme-preview { display: block; width: 100%; }.theme-option-footer { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; padding: 14rpx; }.theme-name,.theme-description { display: block; }.theme-name { color: var(--theme-text-strong); font-size: 24rpx; font-weight: 600; }.theme-description { overflow: hidden; max-width: 210rpx; margin-top: 5rpx; color: var(--theme-text-muted); font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }.theme-check { display: flex; align-items: center; justify-content: center; flex: 0 0 32rpx; width: 32rpx; height: 32rpx; border-radius: 50%; color: #fff; background: var(--theme-primary); font-size: 20rpx; }.logout { margin: 52rpx 24rpx; color: var(--theme-primary); background: var(--theme-primary-soft); }.avatar-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(0,0,0,.52); }.avatar-dialog { width: 100%; padding: 18rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); border-radius: 32rpx 32rpx 0 0; background: var(--theme-surface); box-sizing: border-box; }.dialog-handle { width: 72rpx; height: 8rpx; margin: 0 auto 30rpx; border-radius: 10rpx; background: var(--theme-border); }.dialog-title,.dialog-tip { display: block; text-align: center; }.dialog-title { color: var(--theme-text); font-size: 34rpx; font-weight: 600; }.dialog-avatar { display: flex; align-items: center; justify-content: center; width: 200rpx; height: 200rpx; margin: 28rpx auto 20rpx; overflow: hidden; border-radius: 50%; background: var(--theme-primary-soft); color: var(--theme-text-muted); font-size: 68rpx; }.dialog-tip { margin-bottom: 28rpx; color: var(--theme-text-secondary); font-size: 25rpx; }.change-avatar { color: var(--theme-primary); background: var(--theme-primary-soft); }.confirm-avatar { margin-top: 18rpx; color: #fff; background: var(--theme-primary); }.cancel-avatar { margin-top: 18rpx; color: var(--theme-text-secondary); background: var(--theme-page-bg); }.crop-mask { position: fixed; z-index: 1001; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; padding: 40rpx; background: rgba(0,0,0,.65); }.crop-dialog { width: 100%; padding: 34rpx 28rpx 28rpx; border-radius: 24rpx; background: var(--theme-surface); box-sizing: border-box; }.crop-title,.crop-tip { display: block; text-align: center; }.crop-title { color: var(--theme-text); font-size: 34rpx; font-weight: 600; }.crop-tip { margin: 12rpx 0 28rpx; color: var(--theme-text-secondary); font-size: 24rpx; }.crop-window { position: relative; margin: 0 auto; overflow: hidden; background: var(--theme-text); touch-action: none; }.crop-image { position: absolute; top: 0; left: 0; max-width: none; }.crop-tools { display: flex; align-items: center; justify-content: center; gap: 24rpx; margin: 26rpx 0; color: var(--theme-text-secondary); font-size: 26rpx; }.crop-control { min-width: 136rpx; margin: 0; color: var(--theme-primary); background: var(--theme-primary-soft); font-size: 25rpx; }.crop-actions { display: flex; gap: 20rpx; }.crop-actions button { flex: 1; margin: 0; }.crop-cancel { color: var(--theme-text-secondary); background: var(--theme-page-bg); }.crop-confirm { color: #fff; background: var(--theme-primary); }.crop-canvas { position: fixed; top: -1000px; left: -1000px; width: 600px; height: 600px; opacity: 0; pointer-events: none; }
</style>
