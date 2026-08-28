<template>
  <view :class="['ledger-page', `theme-${themeStore.id}`]" :key="themeStore.id" :style="themeStore.pageStyle">
    <view class="range-bar" @click="openPicker">
      <view><text class="range-title">{{ periodTitle }}</text><text class="range-detail">{{ range.startDate }} 至 {{ range.endDate }}</text></view>
      <view class="range-actions"><view class="range-arrow" /></view>
    </view>
    <view class="summary-card"><view><text class="summary-label">收入</text><text class="income">+{{ formatAmount(summary.incomeTotal) }}</text></view><view><text class="summary-label">支出</text><text class="expense">-{{ formatAmount(summary.expenseTotal) }}</text></view><view><text class="summary-label">结余</text><text class="balance">{{ formatAmount(summary.netAmount) }}</text></view></view>
    <view class="list-title">流水明细 <text class="muted">{{ transactions.length }} 笔</text></view>
    <view v-if="loading" class="empty">加载中…</view><view v-else-if="!transactions.length" class="empty">这个时间段还没有流水</view>
    <view v-else class="day-groups"><view v-for="group in transactionGroups" :key="group.date" class="day-group"><view class="day-header"><text class="day-label">{{ group.label }}</text><text class="day-date">{{ group.date }}</text></view><view class="transaction-list"><view v-for="item in group.items" :key="item.id" class="transaction-item" @click="goEdit(item)"><view class="icon" :class="item.transactionType === 'INCOME' ? 'income-bg' : 'expense-bg'">{{ item.transactionType === 'INCOME' ? '收' : '支' }}</view><view class="item-main"><text class="item-name">{{ categoryName(item) }}</text><text class="item-note">{{ item.note || '暂无备注' }}</text></view><view class="item-right"><text :class="item.transactionType === 'INCOME' ? 'income' : 'expense'">{{ item.transactionType === 'INCOME' ? '+' : '-' }}{{ formatAmount(item.amount) }}</text></view><text class="delete" @click.stop="remove(item)">删除</text></view></view></view></view>
    <view class="add-fab" @click="goCreate"><u-icon name="plus" color="#ffffff" size="26" /></view>

    <!-- #ifdef APP-PLUS -->
    <custom-tab-bar />
    <!-- #endif -->

    <view v-if="pickerVisible" class="picker-mask" @click.self="closePicker">
      <view class="date-picker">
        <view class="picker-handle" />
        <view class="picker-tabs"><text v-for="mode in pickerModes" :key="mode.value" :class="['picker-tab', { active: pickerMode === mode.value }]" @click="pickerMode = mode.value">{{ mode.label }}</text></view>
        <view class="picker-nav"><text class="nav-button" @click="previousPicker">‹</text><text class="picker-heading">{{ pickerHeading }}</text><text class="nav-button" @click="nextPicker">›</text></view>
        <view v-if="pickerMode === 'MONTH'" class="date-grid month-grid"><text v-for="month in months" :key="month.value" :class="['date-cell', { active: isActiveMonth(month.value) }]" @click="selectMonth(month.value)">{{ month.label }}</text></view>
        <view v-else-if="pickerMode === 'YEAR'" class="date-grid year-grid"><text v-for="year in years" :key="year" :class="['date-cell', { active: isActiveYear(year) }]" @click="selectYear(year)">{{ year }}</text></view>
        <view v-else class="week-list"><view v-for="week in weeks" :key="week.startDate" :class="['week-cell', { active: isActiveWeek(week) }]" @click="selectWeek(week)"><text>{{ weekLabel(week) }}</text><text>{{ week.startDate }} 至 {{ week.endDate }}</text></view></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatAmount, monthRange, weekRangesInMonth, yearRange } from '../../utils/date'
import { showRequestError } from '../../utils/request'
import { themeStore } from '../../stores/theme'
// #ifdef APP-PLUS
import CustomTabBar from '../../custom-tab-bar/index.vue'
// #endif

const range = reactive(monthRange())
const summary = reactive({ incomeTotal: 0, expenseTotal: 0, netAmount: 0 })
const categories = ref([])
const transactions = ref([])
const loading = ref(false)
const pickerVisible = ref(false)
const pickerMode = ref('MONTH')
const pickerYear = ref(new Date().getFullYear())
const pickerMonth = ref(new Date().getMonth())
const periodType = ref('MONTH')
const pickerModes = [{ value: 'WEEK', label: '按周' }, { value: 'MONTH', label: '按月' }, { value: 'YEAR', label: '按年' }]
const months = Array.from({ length: 12 }, (_, index) => ({ value: index, label: `${index + 1}月` }))
const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']
let requestId = 0
const categoryMap = computed(() => new Map(categories.value.map(item => [`${item.source}:${item.id}`, item.name])))
const transactionGroups = computed(() => {
  const groups = new Map()
  transactions.value.forEach((item) => {
    if (!groups.has(item.occurredOn)) groups.set(item.occurredOn, [])
    groups.get(item.occurredOn).push(item)
  })
  return Array.from(groups, ([date, items]) => ({ date, items, label: formatDayLabel(date) }))
})
const years = computed(() => Array.from({ length: 12 }, (_, index) => pickerYear.value - 11 + index))
const weeks = computed(() => weekRangesInMonth(pickerYear.value, pickerMonth.value))
const pickerHeading = computed(() => pickerMode.value === 'WEEK' ? `${pickerYear.value}年${pickerMonth.value + 1}月` : `${pickerYear.value}年`)
const periodTitle = computed(() => {
  if (periodType.value === 'YEAR') return `${range.startDate.slice(0, 4)}年账本`
  if (periodType.value === 'MONTH') return `${range.startDate.slice(0, 4)}年${Number(range.startDate.slice(5, 7))}月账本`
  return `${range.startDate.slice(5)} 至 ${range.endDate.slice(5)}`
})

onShow(load)
async function load() {
  const currentRequest = ++requestId
  loading.value = true
  try {
    const [categoryData, transactionData, summaryData] = await Promise.all([appApi.listCategories(), appApi.listTransactions(range), appApi.getSummary(range)])
    if (currentRequest !== requestId) return
    categories.value = categoryData
    transactions.value = transactionData
    Object.assign(summary, summaryData)
  } catch (error) {
    if (currentRequest === requestId) showRequestError(error)
  } finally { if (currentRequest === requestId) loading.value = false }
}

function dateParts(dateString) { return { year: Number(dateString.slice(0, 4)), month: Number(dateString.slice(5, 7)) - 1, day: Number(dateString.slice(8, 10)) } }
function formatDayLabel(dateString) { const { year, month, day } = dateParts(dateString); return `${month + 1}月${day}日 星期${weekdayLabels[new Date(year, month, day).getDay()]}` }
function openPicker() { const date = dateParts(range.startDate); pickerYear.value = date.year; pickerMonth.value = date.month; pickerMode.value = periodType.value; pickerVisible.value = true }
function closePicker() { pickerVisible.value = false }
function previousPicker() {
  if (pickerMode.value === 'WEEK') { const previous = new Date(pickerYear.value, pickerMonth.value - 1, 1); pickerYear.value = previous.getFullYear(); pickerMonth.value = previous.getMonth() } else pickerYear.value -= 1
}
function nextPicker() {
  if (pickerMode.value === 'WEEK') { const next = new Date(pickerYear.value, pickerMonth.value + 1, 1); pickerYear.value = next.getFullYear(); pickerMonth.value = next.getMonth() } else pickerYear.value += 1
}
async function commitRange(type, nextRange) { periodType.value = type; Object.assign(range, nextRange); pickerVisible.value = false; await load() }
function selectMonth(month) { commitRange('MONTH', monthRange(new Date(pickerYear.value, month, 1))) }
function selectYear(year) { commitRange('YEAR', yearRange(year)) }
function selectWeek(week) { commitRange('WEEK', week) }
function isActiveMonth(month) { return periodType.value === 'MONTH' && range.startDate === monthRange(new Date(pickerYear.value, month, 1)).startDate }
function isActiveYear(year) { return periodType.value === 'YEAR' && range.startDate === yearRange(year).startDate }
function isActiveWeek(week) { return periodType.value === 'WEEK' && range.startDate === week.startDate }
function weekLabel(week) { const start = dateParts(week.startDate); const end = dateParts(week.endDate); return `${start.month + 1}月${start.day}日 - ${end.month + 1}月${end.day}日` }
function categoryName(item) { const id = item.categorySource === 'SYSTEM' ? item.systemCategoryId : item.categoryId; return categoryMap.value.get(`${item.categorySource || 'CUSTOM'}:${id}`) || '分类已停用或删除' }
function goCreate() { uni.navigateTo({ url: '/pages/ledger/transaction-form' }) }
function goEdit(item) { uni.navigateTo({ url: `/pages/ledger/transaction-form?id=${item.id}` }) }
function remove(item) { uni.showModal({ title: '删除流水', content: '删除后无法恢复，确定继续吗？', success: async ({ confirm }) => { if (!confirm) return; try { await appApi.deleteTransaction(item.id); await load(); uni.showToast({ title: '已删除', icon: 'success' }) } catch (error) { showRequestError(error) } } }) }
</script>

<style scoped>
.ledger-page { min-height: 100vh; padding-top: var(--status-bar-height, 0); background: var(--theme-page-bg); box-sizing: border-box; }
.range-bar { display: flex; align-items: center; justify-content: space-between; margin: 24rpx 24rpx 0; padding: 24rpx 28rpx; border-radius: 22rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36,58,99,.05); }.range-title,.range-detail { display: block; }.range-title { color: #1d2939; font-size: 32rpx; font-weight: 600; }.range-detail { margin-top: 8rpx; color: #98a2b3; font-size: 23rpx; }.range-arrow { position: relative; display: block; width: 30rpx; height: 30rpx; border: 3rpx solid #667085; border-radius: 50%; box-sizing: border-box; }.range-arrow::before,.range-arrow::after { position: absolute; border-radius: 3rpx; background: #667085; content: ''; }.range-arrow::before { top: 5rpx; left: 11rpx; width: 3rpx; height: 11rpx; }.range-arrow::after { top: 14rpx; left: 13rpx; width: 9rpx; height: 3rpx; }.summary-card { display: flex; justify-content: space-between; margin: 24rpx; padding: 30rpx; border-radius: 24rpx; color: #fff; background: linear-gradient(135deg, #1677ff, #5c9dff); }.summary-card view { display: flex; flex: 1; flex-direction: column; gap: 12rpx; }.summary-card view:nth-child(2) { align-items: center; } .summary-card view:nth-child(3) { align-items: flex-end; }.summary-label { color: rgba(255,255,255,.76); font-size: 24rpx; }.summary-card .income,.summary-card .expense,.balance { color: #fff; font-size: 30rpx; font-weight: 600; }.list-title { padding: 36rpx 28rpx 16rpx; color: #344054; font-size: 30rpx; font-weight: 600; }.list-title .muted { margin-left: 10rpx; font-size: 24rpx; font-weight: 400; }.day-groups { padding-bottom: calc(150rpx + var(--tab-bar-height, var(--window-bottom)) + env(safe-area-inset-bottom)); }.day-group { margin: 0 24rpx 28rpx; }.day-header { display: flex; align-items: center; justify-content: space-between; padding: 4rpx 4rpx 14rpx; }.day-label { color: #344054; font-size: 27rpx; font-weight: 600; }.day-date { color: #98a2b3; font-size: 23rpx; }.transaction-list { overflow: hidden; border-radius: 24rpx; background: #fff; }.transaction-item { display: flex; align-items: center; min-height: 126rpx; padding: 0 22rpx; border-bottom: 1rpx solid #f0f2f5; }.transaction-item:last-child { border: 0; }.icon { width: 64rpx; height: 64rpx; border-radius: 50%; text-align: center; line-height: 64rpx; font-size: 24rpx; }.income-bg { color: #16a34a; background: #dcfce7; }.expense-bg { color: #e11d48; background: #ffe4e6; }.item-main { display: flex; flex: 1; flex-direction: column; gap: 8rpx; margin-left: 18rpx; }.item-name { font-weight: 500; }.item-note { color: #98a2b3; font-size: 23rpx; }.item-right { display: flex; flex-direction: column; align-items: flex-end; }.income { color: #16a34a; }.expense { color: #e11d48; }.delete { margin-left: 16rpx; color: #98a2b3; font-size: 23rpx; }.add-fab { position: fixed; z-index: 20; bottom: calc(28rpx + var(--tab-bar-height, var(--window-bottom)) + env(safe-area-inset-bottom)); left: 50%; display: flex; align-items: center; justify-content: center; width: 112rpx; height: 112rpx; border: 8rpx solid #f5f7fb; border-radius: 50%; color: #fff; background: #1677ff; box-shadow: 0 12rpx 28rpx rgba(22,119,255,.36); transform: translateX(-50%); }.add-fab text { font-size: 72rpx; font-weight: 300; line-height: 1; }.picker-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(0,0,0,.5); }.date-picker { width: 100%; min-height: 610rpx; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border-radius: 32rpx 32rpx 0 0; background: #fff; box-sizing: border-box; }.picker-handle { width: 72rpx; height: 8rpx; margin: 0 auto 30rpx; border-radius: 10rpx; background: #e4e7ec; }.picker-tabs { display: flex; justify-content: space-around; margin-bottom: 34rpx; }.picker-tab { position: relative; padding: 8rpx 16rpx; color: #98a2b3; font-size: 30rpx; }.picker-tab.active { color: #1d2939; font-weight: 600; }.picker-tab.active::after { position: absolute; right: 16rpx; bottom: 0; left: 16rpx; height: 5rpx; border-radius: 6rpx; background: #1677ff; content: ''; }.picker-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; }.nav-button { width: 70rpx; color: #1d2939; font-size: 68rpx; line-height: 1; text-align: center; }.picker-heading { color: #1d2939; font-size: 34rpx; font-weight: 600; }.date-grid { display: grid; grid-template-columns: repeat(3, 1fr); row-gap: 24rpx; }.date-cell { display: flex; align-items: center; justify-content: center; height: 76rpx; border-radius: 16rpx; color: #344054; font-size: 29rpx; }.date-cell.active { color: #fff; background: #1677ff; box-shadow: 0 8rpx 16rpx rgba(22,119,255,.22); }.week-list { display: flex; flex-direction: column; gap: 16rpx; max-height: 440rpx; overflow-y: auto; }.week-cell { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 24rpx; border-radius: 18rpx; color: #344054; background: #f7f8fa; font-size: 28rpx; }.week-cell text:last-child { color: #98a2b3; font-size: 22rpx; }.week-cell.active { color: #fff; background: #1677ff; }.week-cell.active text:last-child { color: rgba(255,255,255,.78); }
.range-actions { display: flex; align-items: center; justify-content: center; width: 52rpx; height: 52rpx; border-radius: 16rpx; background: #f5f8fd; }.range-arrow { position: relative; display: block; width: 30rpx; height: 30rpx; border: 3rpx solid #667085; border-radius: 50%; box-sizing: border-box; }.range-arrow::before,.range-arrow::after { position: absolute; border-radius: 3rpx; background: #667085; content: ''; }.range-arrow::before { top: 5rpx; left: 11rpx; width: 3rpx; height: 11rpx; }.range-arrow::after { top: 14rpx; left: 13rpx; width: 9rpx; height: 3rpx; }

/* 主题覆盖：卡片、汇总、日期弹层与新增操作统一使用运行时主题令牌；收支保留语义色。 */
.range-bar, .transaction-list, .date-picker { background: var(--theme-surface) !important; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }
.range-title, .list-title, .day-label, .picker-tab.active, .nav-button, .picker-heading { color: var(--theme-text) !important; }
.range-detail, .day-date, .item-note, .delete, .picker-tab, .week-cell text:last-child { color: var(--theme-text-muted) !important; }
.range-actions { background: var(--theme-primary-soft) !important; }
.range-arrow { border-color: var(--theme-text-secondary) !important; background: transparent !important; }
.range-arrow::before, .range-arrow::after { background: var(--theme-text-secondary) !important; }
.summary-card { background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-end)) !important; box-shadow: 0 12rpx 30rpx var(--theme-primary-shadow) !important; }
.transaction-item { border-color: var(--theme-border) !important; }
.transaction-item:active { background: var(--theme-primary-soft) !important; }
.item-name { color: var(--theme-text-strong) !important; }
.add-fab { border-color: var(--theme-page-bg) !important; background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-end)) !important; box-shadow: 0 12rpx 28rpx var(--theme-primary-shadow) !important; }
.add-fab:active { transform: translateX(-50%) scale(.94); }
.picker-handle { background: var(--theme-border) !important; }
.picker-tab.active::after, .date-cell.active, .week-cell.active { background: var(--theme-primary) !important; }
.date-cell.active { box-shadow: 0 8rpx 16rpx var(--theme-primary-shadow) !important; }
.date-cell { color: var(--theme-text-strong) !important; }
.week-cell { color: var(--theme-text-strong) !important; background: var(--theme-page-bg) !important; }
.week-cell.active, .week-cell.active text:last-child { color: #fff !important; }
</style>
