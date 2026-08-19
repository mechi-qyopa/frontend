<template>
  <view class="page">
    <view class="card form"><text class="form-title">我的自定义分类</text><input v-model.trim="form.name" class="input" placeholder="分类名称，如：宠物" maxlength="32" /><view class="type-row"><view :class="['pill', form.transactionType === 'EXPENSE' && 'selected-expense']" @click="form.transactionType = 'EXPENSE'">支出</view><view :class="['pill', form.transactionType === 'INCOME' && 'selected-income']" @click="form.transactionType = 'INCOME'">收入</view><button class="small-add" @click="save">{{ editingId ? '更新' : '添加' }}</button></view></view>
    <view v-for="type in ['EXPENSE', 'INCOME']" :key="type" class="section"><text class="section-title">{{ type === 'EXPENSE' ? '系统支出分类（后台维护）' : '系统收入分类（后台维护）' }}</text><view class="category-card"><view v-for="item in systemByType(type)" :key="`system-${item.id}`" class="category-item"><text>{{ item.name }}</text><text :class="item.status === 'ACTIVE' ? 'readonly' : 'disabled'">{{ item.status === 'ACTIVE' ? '系统分类' : '已停用' }}</text></view><view v-if="!systemByType(type).length" class="empty small-empty">暂无系统分类</view></view></view>
    <view v-for="type in ['EXPENSE', 'INCOME']" :key="`custom-${type}`" class="section"><text class="section-title">{{ type === 'EXPENSE' ? '我的支出分类' : '我的收入分类' }}</text><view class="category-card"><view v-for="item in customByType(type)" :key="`custom-${item.id}`" class="category-item"><text>{{ item.name }}</text><view><text class="edit" @click="edit(item)">编辑</text><text class="delete" @click="remove(item)">删除</text></view></view><view v-if="!customByType(type).length" class="empty small-empty">暂无自定义分类</view></view></view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'

const categories = ref([]); const editingId = ref(null); const form = reactive({ name: '', transactionType: 'EXPENSE' })
onShow(load)
async function load() { try { categories.value = await appApi.listCategories() } catch (error) { showRequestError(error) } }
function systemByType(type) { return categories.value.filter(item => item.source === 'SYSTEM' && item.transactionType === type) }
function customByType(type) { return categories.value.filter(item => item.source === 'CUSTOM' && item.transactionType === type) }
async function save() { if (!form.name) return uni.showToast({ title: '请输入分类名称', icon: 'none' }); try { if (editingId.value) await appApi.updateCategory(editingId.value, form); else await appApi.createCategory(form); reset(); await load(); uni.showToast({ title: '已保存', icon: 'success' }) } catch (error) { showRequestError(error) } }
function edit(item) { editingId.value = item.id; form.name = item.name; form.transactionType = item.transactionType }
function reset() { editingId.value = null; form.name = ''; form.transactionType = 'EXPENSE' }
function remove(item) { uni.showModal({ title: '删除自定义分类', content: `确定删除“${item.name}”吗？`, success: async ({ confirm }) => { if (!confirm) return; try { await appApi.deleteCategory(item.id); await load(); uni.showToast({ title: '已删除', icon: 'success' }) } catch (error) { showRequestError(error) } } }) }
</script>

<style scoped>
.page { padding: 24rpx; }.form { padding: 24rpx; }.form-title { display: block; margin-bottom: 16rpx; color: #344054; font-weight: 600; }.type-row { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; }.pill { padding: 14rpx 22rpx; border-radius: 16rpx; color: #667085; background: #f2f4f7; font-size: 25rpx; }.selected-expense { color: #e11d48; background: #fff1f2; }.selected-income { color: #16a34a; background: #dcfce7; }.small-add { flex: 1; height: 60rpx; color: #fff; line-height: 60rpx; background: #1677ff; font-size: 26rpx; }.section { margin-top: 38rpx; }.section-title { display: block; margin: 0 8rpx 14rpx; color: #344054; font-size: 29rpx; font-weight: 600; }.category-card { overflow: hidden; border-radius: 20rpx; background: #fff; }.category-item { display: flex; align-items: center; justify-content: space-between; padding: 26rpx; border-bottom: 1rpx solid #f2f4f7; }.category-item:last-child { border: 0; }.edit { margin-right: 26rpx; color: #1677ff; font-size: 25rpx; }.delete { color: #e11d48; font-size: 25rpx; }.readonly { color: #667085; font-size: 24rpx; }.disabled { color: #e11d48; font-size: 24rpx; }.small-empty { padding: 42rpx; }
</style>
