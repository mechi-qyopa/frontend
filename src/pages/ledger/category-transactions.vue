<template>
  <view class="page">
    <view v-if="!valid" class="empty">页面参数无效</view>
    <template v-else>
      <view class="range-card"><text class="range-label">统计区间</text><text class="range-value">{{ startDate }} 至 {{ endDate }}</text></view>
      <view class="list-title">{{ categoryName }}流水 <text class="muted">{{ transactions.length }} 笔</text></view>
      <view v-if="loading" class="empty">加载中…</view>
      <view v-else-if="!transactions.length" class="empty">该分类在此时间段暂无流水</view>
      <view v-else class="day-groups"><view v-for="group in transactionGroups" :key="group.date" class="day-group"><view class="day-header"><text class="day-label">{{ group.label }}</text><text class="day-date">{{ group.date }}</text></view><view class="transaction-list"><view v-for="item in group.items" :key="item.id" class="transaction-item" @click="goEdit(item)"><view class="icon category-icon-bg"><text class="icon-emoji">{{ getCategoryIcon(item) }}</text><image v-if="getCategoryImage(item)" class="icon-image" :src="getCategoryImage(item)" mode="aspectFill" /></view><view class="item-main"><text class="item-name">{{ resolveCategoryName(item) }}</text><text class="item-note">{{ item.note || '暂无备注' }}</text></view><view class="item-right"><text :class="item.transactionType === 'INCOME' ? 'income' : 'expense'">{{ item.transactionType === 'INCOME' ? '+' : '-' }}{{ formatAmount(item.amount) }}</text></view><text class="delete" @click.stop="remove(item)">删除</text></view></view></view></view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatAmount } from '../../utils/date'
import { showRequestError } from '../../utils/request'
import { buildCategoryMap, categoryIcon, resolveCategory } from '../../utils/category-icon'

const categorySource = ref('')
const categoryId = ref('')
const categoryName = ref('分类')
const startDate = ref('')
const endDate = ref('')
const valid = ref(false)
const categories = ref([])
const transactions = ref([])
const loading = ref(false)
let requestId = 0

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']
const categoryMap = computed(() => buildCategoryMap(categories.value))
const transactionGroups = computed(() => {
  const groups = new Map()
  transactions.value.forEach((item) => {
    if (!groups.has(item.occurredOn)) groups.set(item.occurredOn, [])
    groups.get(item.occurredOn).push(item)
  })
  return Array.from(groups, ([date, items]) => ({ date, items, label: formatDayLabel(date) }))
})

onLoad((options) => {
  categorySource.value = options.categorySource || ''
  categoryId.value = options.categoryId || ''
  categoryName.value = safeDecode(options.name) || '已删除分类'
  startDate.value = options.startDate || ''
  endDate.value = options.endDate || ''
  valid.value = Boolean(categorySource.value && categoryId.value && startDate.value && endDate.value && startDate.value <= endDate.value)
  if (!valid.value) {
    uni.showToast({ title: '页面参数无效', icon: 'none' })
    return
  }
  uni.setNavigationBarTitle({ title: `${categoryName.value}流水` })
})

onShow(() => {
  if (valid.value) load()
})

async function load() {
  const currentRequest = ++requestId
  loading.value = true
  try {
    const [categoryData, transactionData] = await Promise.all([
      appApi.listCategories(),
      appApi.listTransactions({ startDate: startDate.value, endDate: endDate.value })
    ])
    if (currentRequest !== requestId) return
    categories.value = categoryData
    transactions.value = transactionData.filter(item => {
      const source = item.categorySource || 'CUSTOM'
      const id = source === 'SYSTEM' ? item.systemCategoryId : item.categoryId
      return source === categorySource.value && String(id) === String(categoryId.value)
    })
  } catch (error) {
    if (currentRequest === requestId) showRequestError(error)
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function safeDecode(value) { try { return value ? decodeURIComponent(value) : '' } catch { return value } }
function formatDayLabel(dateString) {
  const year = Number(dateString.slice(0, 4))
  const month = Number(dateString.slice(5, 7)) - 1
  const day = Number(dateString.slice(8, 10))
  return `${month + 1}月${day}日 星期${weekdayLabels[new Date(year, month, day).getDay()]}`
}
function resolveCategoryName(item) {
  const cat = resolveCategory(item, categoryMap.value)
  return cat?.name || '分类已停用或删除'
}
function getCategoryIcon(item) {
  const cat = resolveCategory(item, categoryMap.value)
  return categoryIcon(cat?.name, item.transactionType)
}
function getCategoryImage(item) {
  const cat = resolveCategory(item, categoryMap.value)
  return cat?.imageUrl || ''
}
function goEdit(item) { uni.navigateTo({ url: `/pages/ledger/transaction-form?id=${item.id}` }) }
function remove(item) {
  uni.showModal({
    title: '删除流水',
    content: '删除后无法恢复，确定继续吗？',
    success: async ({ confirm }) => {
      if (!confirm) return
      try {
        await appApi.deleteTransaction(item.id)
        await load()
        uni.showToast({ title: '已删除', icon: 'success' })
      } catch (error) {
        showRequestError(error)
      }
    }
  })
}
</script>

<style scoped>
.page { min-height: 100vh; padding-top: 24rpx; background: #f5f7fb; box-sizing: border-box; }.range-card { display: flex; align-items: center; justify-content: space-between; margin: 0 24rpx; padding: 24rpx 28rpx; border-radius: 22rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36,58,99,.05); }.range-label { color: #667085; font-size: 26rpx; }.range-value { color: #1d2939; font-size: 25rpx; font-weight: 600; }.list-title { padding: 36rpx 28rpx 16rpx; color: #344054; font-size: 30rpx; font-weight: 600; }.list-title .muted { margin-left: 10rpx; font-size: 24rpx; font-weight: 400; }.day-groups { padding-bottom: calc(48rpx + var(--window-bottom) + env(safe-area-inset-bottom)); }.day-group { margin: 0 24rpx 28rpx; }.day-header { display: flex; align-items: center; justify-content: space-between; padding: 4rpx 4rpx 14rpx; }.day-label { color: #344054; font-size: 27rpx; font-weight: 600; }.day-date { color: #98a2b3; font-size: 23rpx; }.transaction-list { overflow: hidden; border-radius: 24rpx; background: #fff; }.transaction-item { display: flex; align-items: center; min-height: 126rpx; padding: 0 22rpx; border-bottom: 1rpx solid #f0f2f5; }.transaction-item:last-child { border: 0; }.icon { position: relative; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 50%; overflow: hidden; box-sizing: border-box; }.category-icon-bg { background: #f2f4f7; }.icon-image { position: absolute; inset: 0; width: 100%; height: 100%; }.icon-emoji { font-size: 36rpx; line-height: 1; filter: saturate(.9); }.item-main { display: flex; flex: 1; flex-direction: column; gap: 8rpx; margin-left: 18rpx; }.item-name { font-weight: 500; }.item-note { color: #98a2b3; font-size: 23rpx; }.item-right { display: flex; flex-direction: column; align-items: flex-end; }.income { color: #16a34a; }.expense { color: #e11d48; }.delete { margin-left: 16rpx; color: #98a2b3; font-size: 23rpx; }.empty { padding: 100rpx 24rpx; color: #98a2b3; font-size: 26rpx; text-align: center; }
</style>
