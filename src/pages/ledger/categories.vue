<template>
  <view class="page">
    <view class="card form">
      <text class="form-title">我的自定义分类</text>
      <input v-model.trim="form.name" class="input" placeholder="分类名称，如：宠物" maxlength="32" />

      <view class="image-upload-section">
        <view class="image-upload-heading">
          <text class="image-upload-title">分类图标</text>
          <text class="image-upload-hint">可选，可从相册选择或拍照</text>
        </view>
        <view class="image-upload-row">
          <button class="image-upload-button" :disabled="uploading" @click="chooseImage">
            <text class="image-upload-icon">＋</text>
            <text>{{ uploading ? '图片上传中...' : form.imageUrl ? '更换图片' : '选择图片' }}</text>
          </button>
          <view v-if="form.imageUrl" class="image-preview-wrap">
            <image class="form-image-preview" :src="form.imageUrl" mode="aspectFill" />
          </view>
          <view v-else class="image-placeholder">
            <text class="image-placeholder-icon">图</text>
            <text class="image-placeholder-text">未选择</text>
          </view>
          <text v-if="form.imageUrl && !uploading" class="clear-image" @click="clearImage">移除</text>
        </view>
      </view>

      <view class="type-row">
        <view :class="['pill', form.transactionType === 'EXPENSE' && 'selected-expense']" @click="form.transactionType = 'EXPENSE'">支出</view>
        <view :class="['pill', form.transactionType === 'INCOME' && 'selected-income']" @click="form.transactionType = 'INCOME'">收入</view>
        <button class="small-add" :disabled="uploading" @click="save">{{ editingId ? '更新' : '添加' }}</button>
      </view>
    </view>

    <view v-for="type in ['EXPENSE', 'INCOME']" :key="type" class="section">
      <text class="section-title">{{ type === 'EXPENSE' ? '系统支出分类（后台维护）' : '系统收入分类（后台维护）' }}</text>
      <view class="category-card">
        <view v-for="item in systemByType(type)" :key="`system-${item.id}`" class="category-item">
          <view class="category-main"><image v-if="item.imageUrl" class="category-thumbnail" :src="item.imageUrl" mode="aspectFill" /><text>{{ item.name }}</text></view>
          <text :class="item.status === 'ACTIVE' ? 'readonly' : 'disabled'">{{ item.status === 'ACTIVE' ? '系统分类' : '已停用' }}</text>
        </view>
        <view v-if="!systemByType(type).length" class="empty small-empty">暂无系统分类</view>
      </view>
    </view>

    <view v-for="type in ['EXPENSE', 'INCOME']" :key="`custom-${type}`" class="section">
      <text class="section-title">{{ type === 'EXPENSE' ? '我的支出分类' : '我的收入分类' }}</text>
      <view class="category-card">
        <view v-for="item in customByType(type)" :key="`custom-${item.id}`" class="category-item">
          <view class="category-main"><image v-if="item.imageUrl" class="category-thumbnail" :src="item.imageUrl" mode="aspectFill" /><text>{{ item.name }}</text></view>
          <view><text class="edit" @click="edit(item)">编辑</text><text class="delete" @click="remove(item)">删除</text></view>
        </view>
        <view v-if="!customByType(type).length" class="empty small-empty">暂无自定义分类</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'

const categories = ref([]); const editingId = ref(null); const uploading = ref(false); const form = reactive({ name: '', imageUrl: '', transactionType: 'EXPENSE' })
onShow(load)
async function load() { try { categories.value = await appApi.listCategories() } catch (error) { showRequestError(error) } }
function systemByType(type) { return categories.value.filter(item => item.source === 'SYSTEM' && item.transactionType === type) }
function customByType(type) { return categories.value.filter(item => item.source === 'CUSTOM' && item.transactionType === type) }
function chooseImage() { uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: uploadImage, fail: (error) => { if (!error.errMsg?.includes('cancel')) showRequestError(error) } }) }
async function uploadImage({ tempFilePaths }) { const filePath = tempFilePaths?.[0]; if (!filePath) return; uploading.value = true; try { form.imageUrl = await appApi.uploadImage(filePath); uni.showToast({ title: '图片上传成功', icon: 'success' }) } catch (error) { showRequestError(error) } finally { uploading.value = false } }
function clearImage() { form.imageUrl = '' }
async function save() { if (!form.name) return uni.showToast({ title: '请输入分类名称', icon: 'none' }); if (uploading.value) return uni.showToast({ title: '图片上传中，请稍候', icon: 'none' }); try { if (editingId.value) await appApi.updateCategory(editingId.value, form); else await appApi.createCategory(form); reset(); await load(); uni.showToast({ title: '已保存', icon: 'success' }) } catch (error) { showRequestError(error) } }
function edit(item) { editingId.value = item.id; form.name = item.name; form.imageUrl = item.imageUrl || ''; form.transactionType = item.transactionType }
function reset() { editingId.value = null; form.name = ''; form.imageUrl = ''; form.transactionType = 'EXPENSE' }
function remove(item) { uni.showModal({ title: '删除自定义分类', content: `确定删除“${item.name}”吗？`, success: async ({ confirm }) => { if (!confirm) return; try { await appApi.deleteCategory(item.id); await load(); uni.showToast({ title: '已删除', icon: 'success' }) } catch (error) { showRequestError(error) } } }) }
</script>

<style scoped>
.page { padding: 24rpx; }
.form { padding: 24rpx; }
.form-title { display: block; margin-bottom: 16rpx; color: #344054; font-weight: 600; }
.image-upload-section { margin-top: 22rpx; padding: 20rpx; border: 1rpx solid #e7edf8; border-radius: 18rpx; background: linear-gradient(135deg, #f9fbff 0%, #f4f8ff 100%); }
.image-upload-heading { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16rpx; }
.image-upload-title { color: #475467; font-size: 25rpx; font-weight: 600; }
.image-upload-hint { color: #98a2b3; font-size: 21rpx; }
.image-upload-row { display: flex; align-items: center; min-height: 84rpx; }
.image-upload-button { display: flex; align-items: center; justify-content: center; width: 188rpx; height: 76rpx; margin: 0 16rpx 0 0; padding: 0; border: 1rpx dashed #91b9ff; border-radius: 14rpx; color: #1677ff; line-height: 76rpx; background: #fff; font-size: 24rpx; }
.image-upload-button::after { border: 0; }
.image-upload-button[disabled] { opacity: .6; }
.image-upload-icon { margin-right: 8rpx; color: #1677ff; font-size: 34rpx; font-weight: 300; line-height: 1; }
.image-preview-wrap, .image-placeholder { width: 76rpx; height: 76rpx; overflow: hidden; border-radius: 14rpx; }
.image-preview-wrap { box-shadow: 0 4rpx 12rpx rgba(52, 64, 84, .15); background: #fff; }
.form-image-preview { width: 100%; height: 100%; }
.image-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; border: 1rpx dashed #cbd5e1; color: #98a2b3; background: #f8fafc; }
.image-placeholder-icon { width: 27rpx; height: 22rpx; margin-bottom: 4rpx; border-radius: 5rpx; color: #94a3b8; line-height: 22rpx; text-align: center; background: #e2e8f0; font-size: 16rpx; }
.image-placeholder-text { color: #98a2b3; font-size: 18rpx; }
.clear-image { margin-left: 16rpx; padding: 8rpx 12rpx; border-radius: 10rpx; color: #e11d48; background: #fff1f2; font-size: 22rpx; }
.type-row { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; }
.pill { padding: 14rpx 22rpx; border-radius: 16rpx; color: #667085; background: #f2f4f7; font-size: 25rpx; }
.selected-expense { color: #e11d48; background: #fff1f2; }
.selected-income { color: #16a34a; background: #dcfce7; }
.small-add { flex: 1; height: 60rpx; color: #fff; line-height: 60rpx; background: #1677ff; font-size: 26rpx; }
.small-add[disabled] { opacity: .6; }
.section { margin-top: 38rpx; }
.section-title { display: block; margin: 0 8rpx 14rpx; color: #344054; font-size: 29rpx; font-weight: 600; }
.category-card { overflow: hidden; border-radius: 20rpx; background: #fff; }
.category-item { display: flex; align-items: center; justify-content: space-between; padding: 26rpx; border-bottom: 1rpx solid #f2f4f7; }
.category-item:last-child { border: 0; }
.category-main { display: flex; align-items: center; min-width: 0; }
.category-thumbnail { width: 52rpx; height: 52rpx; margin-right: 16rpx; border-radius: 50%; background: #f2f4f7; }
.edit { margin-right: 26rpx; color: #1677ff; font-size: 25rpx; }
.delete { color: #e11d48; font-size: 25rpx; }
.readonly { color: #667085; font-size: 24rpx; }
.disabled { color: #e11d48; font-size: 24rpx; }
.small-empty { padding: 42rpx; }
</style>
