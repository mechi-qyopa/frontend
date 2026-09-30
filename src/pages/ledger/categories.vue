<template>
  <view :class="['page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="card form">
      <text class="form-title">{{ editingId ? '编辑自定义分类' : '新建自定义分类' }}</text>
      <input v-model.trim="form.name" class="input" placeholder="分类名称，如：宠物" maxlength="32" />

      <view class="upload-row">
        <button class="upload-tile" :disabled="uploading" aria-label="选择分类图标" @click="chooseImage">
          <image v-if="form.imageUrl" class="upload-preview" :src="form.imageUrl" mode="aspectFill" />
          <view v-else class="upload-plus"><u-icon name="camera" size="22" /></view>
        </button>
        <view class="upload-meta">
          <text class="upload-title">分类图标</text>
          <text class="upload-hint">{{ uploading ? '图片上传中…' : '可选，从相册选择或拍照' }}</text>
          <text v-if="form.imageUrl && !uploading" class="upload-remove" @click="clearImage">移除图片</text>
        </view>
      </view>

      <view class="type-switch">
        <view class="type-indicator" :class="{ 'indicator-right': form.transactionType === 'INCOME' }" />
        <view :class="['type', { active: form.transactionType === 'EXPENSE' }]" role="button" aria-label="支出分类" @click="setFormType('EXPENSE')"><text>支出</text></view>
        <view :class="['type', { active: form.transactionType === 'INCOME' }]" role="button" aria-label="收入分类" @click="setFormType('INCOME')"><text>收入</text></view>
      </view>

      <text class="picker-title">线条图标<text class="picker-hint">可选一个，未选时按名称自动匹配</text></text>
      <view class="icon-grid">
        <view v-for="key in iconList" :key="key" :class="['icon-cell', { selected: form.iconKey === key }]" role="button" :aria-label="`图标 ${key}`" @click="pickIcon(key)">
          <category-icon :name="form.name" :type="form.transactionType" :icon-key="key" :size="40" :color="form.iconKey === key ? themeStore.currentTheme.colors.primary : ''" />
        </view>
      </view>

      <button class="primary-button submit" :disabled="uploading" @click="save">{{ editingId ? '保存修改' : '添加分类' }}</button>
    </view>

    <view v-for="type in ['EXPENSE', 'INCOME']" :key="type" class="section">
      <text class="section-title">{{ type === 'EXPENSE' ? '系统支出分类' : '系统收入分类' }}<text class="section-tag">后台维护</text></text>
      <view class="card category-card">
        <view v-for="item in systemByType(type)" :key="`system-${item.id}`" class="category-item">
          <view class="category-main">
            <view class="item-icon">
              <image v-if="item.imageUrl" class="item-icon-image" :src="item.imageUrl" mode="aspectFill" />
              <category-icon v-else :name="item.name" :type="item.transactionType" :icon-key="item.iconKey || ''" :size="40" />
            </view>
            <text class="item-name">{{ item.name }}</text>
          </view>
          <text :class="item.status === 'ACTIVE' ? 'item-state' : 'item-state disabled'">{{ item.status === 'ACTIVE' ? '系统分类' : '已停用' }}</text>
        </view>
        <view v-if="!systemByType(type).length" class="empty">暂无系统分类</view>
      </view>
    </view>

    <view v-for="type in ['EXPENSE', 'INCOME']" :key="`custom-${type}`" class="section">
      <text class="section-title">{{ type === 'EXPENSE' ? '我的支出分类' : '我的收入分类' }}</text>
      <view class="card category-card">
        <view v-for="item in customByType(type)" :key="`custom-${item.id}`" class="category-item">
          <view class="category-main">
            <view class="item-icon">
              <image v-if="item.imageUrl" class="item-icon-image" :src="item.imageUrl" mode="aspectFill" />
              <category-icon v-else :name="item.name" :type="item.transactionType" :icon-key="item.iconKey || ''" :size="40" />
            </view>
            <text class="item-name">{{ item.name }}</text>
          </view>
          <view class="item-actions"><text class="edit" @click="edit(item)">编辑</text><text class="delete" @click="remove(item)">删除</text></view>
        </view>
        <view v-if="!customByType(type).length" class="empty">暂无自定义分类</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'
import { themeStore } from '../../stores/theme'
import CategoryIcon from '../../category-icon/index.vue'
import { EXPENSE_ICON_KEY_LIST, INCOME_ICON_KEY_LIST } from '../../utils/category-icon'

const categories = ref([]); const editingId = ref(null); const uploading = ref(false); const form = reactive({ name: '', imageUrl: '', transactionType: 'EXPENSE', iconKey: '' })
const iconList = computed(() => (form.transactionType === 'INCOME' ? INCOME_ICON_KEY_LIST : EXPENSE_ICON_KEY_LIST))
onShow(load)
async function load() { try { categories.value = await appApi.listCategories() } catch (error) { showRequestError(error) } }
function systemByType(type) { return categories.value.filter(item => item.source === 'SYSTEM' && item.transactionType === type) }
function customByType(type) { return categories.value.filter(item => item.source === 'CUSTOM' && item.transactionType === type) }
function chooseImage() { uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: uploadImage, fail: (error) => { if (!error.errMsg?.includes('cancel')) showRequestError(error) } }) }
async function uploadImage({ tempFilePaths }) { const filePath = tempFilePaths?.[0]; if (!filePath) return; uploading.value = true; try { form.imageUrl = await appApi.uploadImage(filePath); form.iconKey = ''; uni.showToast({ title: '图片上传成功', icon: 'success' }) } catch (error) { showRequestError(error) } finally { uploading.value = false } }
function clearImage() { form.imageUrl = '' }
function setFormType(type) { if (form.transactionType !== type) { form.transactionType = type; if (form.iconKey && !iconList.value.includes(form.iconKey)) form.iconKey = '' } }
function pickIcon(key) { const next = form.iconKey === key ? '' : key; form.iconKey = next; if (next) form.imageUrl = '' }
async function save() { if (!form.name) return uni.showToast({ title: '请输入分类名称', icon: 'none' }); if (uploading.value) return uni.showToast({ title: '图片上传中，请稍候', icon: 'none' }); try { if (editingId.value) await appApi.updateCategory(editingId.value, form); else await appApi.createCategory(form); uni.$emit('ledger:invalidate'); reset(); await load(); uni.showToast({ title: '已保存', icon: 'success' }) } catch (error) { showRequestError(error) } }
function edit(item) { editingId.value = item.id; form.name = item.name; form.imageUrl = item.imageUrl || ''; form.transactionType = item.transactionType; form.iconKey = item.iconKey || '' }
function reset() { editingId.value = null; form.name = ''; form.imageUrl = ''; form.transactionType = 'EXPENSE'; form.iconKey = '' }
function remove(item) { uni.showModal({ title: '删除自定义分类', content: `确定删除“${item.name}”吗？`, success: async ({ confirm }) => { if (!confirm) return; try { await appApi.deleteCategory(item.id); uni.$emit('ledger:invalidate'); await load(); uni.showToast({ title: '已删除', icon: 'success' }) } catch (error) { showRequestError(error) } } }) }
</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx 24rpx calc(48rpx + env(safe-area-inset-bottom)); background: var(--theme-page-bg); box-sizing: border-box; }

/* 表单卡 */
.form { padding: 32rpx 28rpx; }
.form-title { display: block; margin-bottom: 24rpx; color: var(--theme-text); font-size: var(--font-title); font-weight: 700; }
.input { height: 84rpx; margin-bottom: 24rpx; padding: 0 26rpx; border-radius: var(--theme-radius-control); color: var(--theme-text-strong); background: var(--theme-page-bg); font-size: var(--font-body); box-sizing: border-box; }

/* 图标上传：一个 squircle 方块 + 右侧说明，选中后方块即预览 */
.upload-row { display: flex; align-items: center; gap: 24rpx; margin-bottom: 26rpx; }
.upload-tile { position: relative; display: flex; width: 108rpx; height: 108rpx; flex: 0 0 108rpx; align-items: center; justify-content: center; margin: 0; padding: 0; overflow: hidden; border: 2rpx dashed var(--theme-border); border-radius: 26rpx; background: var(--theme-page-bg); transition: transform .15s ease, opacity .15s ease; }
.upload-tile::after { border: 0; }
.upload-tile:active { transform: scale(.95); opacity: .85; }
.upload-plus { color: var(--theme-text-muted); }
.upload-preview { position: absolute; inset: 0; width: 100%; height: 100%; }
.upload-meta { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 8rpx; }
.upload-title { color: var(--theme-text-strong); font-size: var(--font-body); font-weight: 600; }
.upload-hint { color: var(--theme-text-muted); font-size: var(--font-caption); }
.upload-remove { align-self: flex-start; padding: 4rpx 0; color: var(--theme-expense); font-size: var(--font-caption); }
.upload-remove:active { opacity: .6; }

/* 支出/收入胶囊切换：与记一笔页同款 */
.type-switch { position: relative; display: flex; margin-bottom: 28rpx; padding: 6rpx; border-radius: 999rpx; background: var(--theme-page-bg); border: 1rpx solid var(--theme-border); }
.type-indicator { position: absolute; top: 6rpx; bottom: 6rpx; left: 6rpx; width: calc(50% - 6rpx); border-radius: 999rpx; background: var(--theme-surface); box-shadow: var(--elev-1); transition: transform .2s ease; }
.type-indicator.indicator-right { transform: translateX(100%); }
.type { position: relative; z-index: 1; flex: 1; padding: 16rpx 0; color: var(--theme-text-secondary); font-size: var(--font-md); text-align: center; transition: color .2s ease; }
.type.active { color: var(--theme-primary); font-weight: 600; }
.type:active { opacity: .7; }

/* 线条图标选择网格 */
.picker-title { display: flex; align-items: baseline; gap: 12rpx; margin-bottom: 16rpx; color: var(--theme-text-strong); font-size: var(--font-caption); font-weight: 600; }
.picker-hint { color: var(--theme-text-muted); font-size: var(--font-caption); font-weight: 400; }
.icon-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 12rpx; margin-bottom: 28rpx; }
.icon-cell { display: flex; align-items: center; justify-content: center; height: 72rpx; border: 2rpx solid var(--theme-border); border-radius: 18rpx; background: var(--theme-page-bg); box-sizing: border-box; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
.icon-cell:active { transform: scale(.92); }
.icon-cell.selected { border-color: var(--theme-primary); background: var(--theme-primary-soft); }
.submit { height: 88rpx; line-height: 88rpx; font-size: var(--font-md); }

/* 分类列表 */
.section { margin-top: 36rpx; }
.section-title { display: flex; align-items: center; gap: 12rpx; margin: 0 8rpx 14rpx; color: var(--theme-text); font-size: var(--font-md); font-weight: 600; }
.section-tag { padding: 4rpx 14rpx; border-radius: 999rpx; color: var(--theme-text-muted); background: var(--theme-primary-soft); font-size: var(--font-caption); font-weight: 400; }
.category-card { overflow: hidden; }
.category-item { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 24rpx; border-bottom: 1rpx solid var(--theme-border); }
.category-item:last-child { border: 0; }
.category-main { display: flex; align-items: center; min-width: 0; }
.item-icon { display: flex; width: 64rpx; height: 64rpx; flex: 0 0 64rpx; align-items: center; justify-content: center; margin-right: 20rpx; overflow: hidden; border: 2rpx solid var(--theme-border); border-radius: 20rpx; background: var(--theme-page-bg); box-sizing: border-box; }
.item-icon-image { width: 100%; height: 100%; }
.item-name { overflow: hidden; color: var(--theme-text-strong); font-size: var(--font-body); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.item-state { flex-shrink: 0; color: var(--theme-text-muted); font-size: var(--font-caption); }
.item-state.disabled { color: var(--theme-expense); }
.item-actions { display: flex; flex-shrink: 0; align-items: center; }
.edit { padding: 20rpx 10rpx 20rpx 20rpx; color: var(--theme-primary); font-size: var(--font-caption); }
.delete { padding: 20rpx 8rpx 20rpx 10rpx; color: var(--theme-expense); font-size: var(--font-caption); }
.edit:active, .delete:active { opacity: .6; }
.empty { padding: 48rpx; color: var(--theme-text-muted); font-size: var(--font-caption); text-align: center; }
</style>
