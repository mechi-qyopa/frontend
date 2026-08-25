<template>
  <view class="page">
    <view class="filter-card">
      <view class="period-tabs">
        <text v-for="item in periodOptions" :key="item.value" :class="['period-tab', { active: periodType === item.value }]" @click="setPeriodType(item.value)">{{ item.label }}</text>
      </view>
      <view v-if="periodType === 'CUSTOM'" class="custom-range">
        <picker mode="date" :value="range.startDate" @change="selectCustomStart"><view class="date-field"><text>开始日期</text><text>{{ range.startDate }}</text></view></picker>
        <text class="range-divider">至</text>
        <picker mode="date" :value="range.endDate" @change="selectCustomEnd"><view class="date-field"><text>结束日期</text><text>{{ range.endDate }}</text></view></picker>
      </view>
      <view v-else class="range-control" @click="openPicker"><view><text class="range-title">{{ periodTitle }}</text><text class="range-detail">{{ range.startDate }} 至 {{ range.endDate }}</text></view><text class="range-arrow">⌄</text></view>
    </view>

    <view class="summary-card">
      <view><text class="summary-label">区间总支出</text><text class="summary-amount">¥ {{ formatAmount(expenseTotal) }}</text></view>
      <view class="summary-side"><text>{{ trendUnitLabel }}均支出</text><text>¥ {{ formatAmount(averageExpense) }}</text></view>
    </view>

    <view class="card trend-card">
      <view class="card-header"><view><text class="card-title">支出趋势</text><text class="card-subtitle">{{ trendUnitLabel }}统计</text></view><text class="peak-label">最高 ¥ {{ formatAmount(peakAmount) }}</text></view>
      <view v-if="trendData.length && expenseTotal > 0" class="trend-chart">
        <view class="trend-y-axis"><text>¥ {{ formatAmount(peakAmount) }}</text><text>¥ 0.00</text></view>
        <view class="trend-plot-wrap">
          <view class="trend-plot">
            <view class="trend-grid-line grid-top" /><view class="trend-grid-line grid-middle" /><view class="trend-grid-line grid-bottom" />
            <view v-for="segment in trendSegments" :key="segment.key" class="trend-segment" :style="segment.style" />
            <view v-for="point in trendPoints" :key="point.key" class="trend-point" :style="point.style" />
          </view>
          <view class="trend-x-axis"><text v-for="point in trendLabelPoints" :key="point.key" :style="point.labelStyle">{{ point.label }}</text></view>
        </view>
      </view>
      <view v-else-if="!loading" class="chart-empty">该区间暂无支出记录</view>
    </view>

    <view class="card category-card">
      <view class="card-header"><view><text class="card-title">支出占比</text><text class="card-subtitle">按分类汇总</text></view><text class="total-count">{{ expenseTransactions }} 笔</text></view>
      <view v-if="categoryStats.length" class="pie-section"><view :class="['pie-chart', { 'single-category': categoryStats.length === 1 }]" :style="pieChartStyle"><view class="pie-hole"><text>总支出</text><text>¥ {{ formatAmount(expenseTotal) }}</text></view></view><view class="pie-legend"><view v-for="(item, index) in categoryStats.slice(0, 4)" :key="item.key" class="legend-item"><text class="legend-dot" :style="{ background: pieColor(index) }" /><view><text>{{ item.name }}</text><text>{{ item.percent.toFixed(1) }}%</text></view></view></view></view>
      <view v-if="categoryStats.length" class="category-list"><view v-for="item in categoryStats" :key="item.key" class="category-row"><view class="category-row-top"><view class="category-name"><text class="rank-badge">{{ item.rank }}</text><text>{{ item.name }}</text></view><text>¥ {{ formatAmount(item.amount) }}</text></view><view class="progress-track"><view class="progress-value" :style="{ width: `${item.percent}%` }" /></view><view class="category-row-bottom"><text>{{ item.count }} 笔</text><text>{{ item.percent.toFixed(1) }}%</text></view></view></view>
      <view v-else-if="!loading" class="empty">该区间暂无支出分类</view><view v-else class="empty">加载中…</view>
    </view>
  </view>

  <view v-if="pickerVisible" class="picker-mask" @click.self="closePicker">
    <view class="date-picker">
      <view class="picker-handle" />
      <view class="picker-tabs"><text v-for="item in pickerModes" :key="item.value" :class="['picker-tab', { active: pickerMode === item.value }]" @click="pickerMode = item.value">{{ item.label }}</text></view>
      <view class="picker-nav"><text class="nav-button" @click="previousPicker">‹</text><text class="picker-heading">{{ pickerHeading }}</text><text class="nav-button" @click="nextPicker">›</text></view>
      <view v-if="pickerMode === 'MONTH'" class="date-grid"><text v-for="month in months" :key="month.value" :class="['date-cell', { active: isActiveMonth(month.value) }]" @click="selectMonth(month.value)">{{ month.label }}</text></view>
      <view v-else-if="pickerMode === 'YEAR'" class="date-grid"><text v-for="year in years" :key="year" :class="['date-cell', { active: isActiveYear(year) }]" @click="selectYear(year)">{{ year }}</text></view>
      <view v-else class="week-list"><view v-for="week in weeks" :key="week.startDate" :class="['week-cell', { active: isActiveWeek(week) }]" @click="selectWeek(week)"><text>{{ weekLabel(week) }}</text><text>{{ week.startDate }} 至 {{ week.endDate }}</text></view></view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatAmount, formatDate, monthRange, weekRange, weekRangesInMonth, yearRange } from '../../utils/date'
import { showRequestError } from '../../utils/request'

const range = reactive(monthRange())
const periodType = ref('MONTH')
const pickerVisible = ref(false)
const pickerMode = ref('MONTH')
const pickerYear = ref(new Date().getFullYear())
const pickerMonth = ref(new Date().getMonth())
const loading = ref(false)
const trendData = ref([])
const categoryStats = ref([])
const expenseTotal = ref(0)
const expenseTransactions = ref(0)
const periodOptions = [{ value: 'WEEK', label: '周' }, { value: 'MONTH', label: '月' }, { value: 'YEAR', label: '年' }, { value: 'CUSTOM', label: '自定义' }]
const pickerModes = [{ value: 'WEEK', label: '按周' }, { value: 'MONTH', label: '按月' }, { value: 'YEAR', label: '按年' }]
const months = Array.from({ length: 12 }, (_, index) => ({ value: index, label: `${index + 1}月` }))
const pieColors = ['#1677ff', '#69a7ff', '#9cc4ff', '#5c9dff', '#7aaef7', '#b9d5ff']
const screenWidth = uni.getSystemInfoSync().windowWidth || 375
const trendPlotWidth = screenWidth * 566 / 750
const trendPlotHeight = screenWidth * 184 / 750
const trendPlotPadding = screenWidth * 12 / 750
let requestId = 0

const years = computed(() => Array.from({ length: 12 }, (_, index) => pickerYear.value - 11 + index))
const weeks = computed(() => weekRangesInMonth(pickerYear.value, pickerMonth.value))
const pickerHeading = computed(() => pickerMode.value === 'WEEK' ? `${pickerYear.value}年${pickerMonth.value + 1}月` : `${pickerYear.value}年`)
const periodTitle = computed(() => periodType.value === 'WEEK' ? '按周费用统计' : periodType.value === 'YEAR' ? `${range.startDate.slice(0, 4)}年费用统计` : `${range.startDate.slice(0, 4)}年${Number(range.startDate.slice(5, 7))}月费用统计`)
const trendUnitLabel = computed(() => periodType.value === 'YEAR' ? '按月' : '按日')
const peakAmount = computed(() => Math.max(0, ...trendData.value.map(item => item.amount)))
const averageExpense = computed(() => expenseTotal.value / Math.max(1, trendData.value.length))
const trendPoints = computed(() => {
  const data = trendData.value
  const max = Math.max(1, ...data.map(item => item.amount))
  const innerWidth = Math.max(1, trendPlotWidth - trendPlotPadding * 2)
  const innerHeight = Math.max(1, trendPlotHeight - trendPlotPadding * 2)
  return data.map((item, index) => {
    const ratio = data.length === 1 ? .5 : index / (data.length - 1)
    const x = trendPlotPadding + innerWidth * ratio
    const y = trendPlotPadding + innerHeight * item.amount / max
    return { key: item.key, label: item.label, x, y, style: { left: `${x}px`, bottom: `${y}px` }, labelStyle: { left: `${x / trendPlotWidth * 100}%` } }
  })
})
const trendSegments = computed(() => trendPoints.value.slice(1).map((point, index) => {
  const previous = trendPoints.value[index]
  const dx = point.x - previous.x
  const dy = previous.y - point.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  return { key: `${previous.key}-${point.key}`, style: { left: `${previous.x}px`, bottom: `${previous.y}px`, width: `${length}px`, transform: `translateY(50%) rotate(${angle}deg)` } }
}))
const trendLabelPoints = computed(() => {
  const points = trendPoints.value
  if (!points.length) return []
  const type = periodType.value
  if (type === 'WEEK' || type === 'YEAR') return points
  if (type === 'CUSTOM') {
    // 自定义区间按粒度决定：按周/按月全部显示，按日隔5天
    const start = parseDate(range.startDate)
    const end = parseDate(range.endDate)
    const totalDays = Math.round((end - start) / 86400000) + 1
    if (totalDays > 31) return points
    return points.filter((_, index) => index % 5 === 0)
  }
  // 月：每隔5天显示
  return points.filter((_, index) => index % 5 === 0)
})
const pieChartStyle = computed(() => {
  if (categoryStats.value.length <= 1) return {}
  let offset = 0
  const segments = categoryStats.value.map((item, index) => {
    const start = offset
    offset += item.percent
    return `${pieColor(index)} ${start}% ${offset}%`
  })
  return { background: `conic-gradient(${segments.join(', ')})` }
})

onShow(load)
async function load() {
  const currentRequest = ++requestId
  loading.value = true
  try {
    const [categories, transactions] = await Promise.all([appApi.listCategories(), appApi.listTransactions(range)])
    if (currentRequest !== requestId) return
    const result = aggregateExpenses(transactions, categories, range, periodType.value)
    trendData.value = result.trend
    categoryStats.value = result.categories
    expenseTotal.value = result.total
    expenseTransactions.value = result.count
  } catch (error) {
    if (currentRequest === requestId) showRequestError(error)
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function setPeriodType(type) {
  if (type === periodType.value) return
  if (type === 'CUSTOM') { periodType.value = type; load(); return }
  const now = new Date()
  if (type === 'WEEK') commitRange(type, weekRange(now))
  if (type === 'MONTH') commitRange(type, monthRange(now))
  if (type === 'YEAR') commitRange(type, yearRange(now.getFullYear()))
}
function openPicker() { const date = parseDate(range.startDate); pickerYear.value = date.getFullYear(); pickerMonth.value = date.getMonth(); pickerMode.value = periodType.value; pickerVisible.value = true }
function closePicker() { pickerVisible.value = false }
function previousPicker() { if (pickerMode.value === 'WEEK') { const previous = new Date(pickerYear.value, pickerMonth.value - 1, 1); pickerYear.value = previous.getFullYear(); pickerMonth.value = previous.getMonth() } else pickerYear.value -= 1 }
function nextPicker() { if (pickerMode.value === 'WEEK') { const next = new Date(pickerYear.value, pickerMonth.value + 1, 1); pickerYear.value = next.getFullYear(); pickerMonth.value = next.getMonth() } else pickerYear.value += 1 }
function commitRange(type, nextRange) { periodType.value = type; Object.assign(range, nextRange); pickerVisible.value = false; load() }
function selectMonth(month) { commitRange('MONTH', monthRange(new Date(pickerYear.value, month, 1))) }
function selectYear(year) { commitRange('YEAR', yearRange(year)) }
function selectWeek(week) { commitRange('WEEK', week) }
function isActiveMonth(month) { return periodType.value === 'MONTH' && range.startDate === monthRange(new Date(pickerYear.value, month, 1)).startDate }
function isActiveYear(year) { return periodType.value === 'YEAR' && range.startDate === yearRange(year).startDate }
function isActiveWeek(week) { return periodType.value === 'WEEK' && range.startDate === week.startDate }
function weekLabel(week) { const start = parseDate(week.startDate); const end = parseDate(week.endDate); return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日` }
function selectCustomStart(event) { const startDate = event.detail.value; if (startDate > range.endDate) return uni.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' }); range.startDate = startDate; load() }
function selectCustomEnd(event) { const endDate = event.detail.value; if (endDate < range.startDate) return uni.showToast({ title: '结束日期不能早于开始日期', icon: 'none' }); range.endDate = endDate; load() }

function aggregateExpenses(transactions, categories, selectedRange, type) {
  const trend = createTrendBuckets(selectedRange, type)
  const trendMap = new Map(trend.map(item => [item.key, item]))
  const categoryNames = new Map(categories.map(item => [`${item.source}:${item.id}`, item.name]))
  const categoryMap = new Map()
  let totalCents = 0
  let count = 0
  transactions.filter(item => item.transactionType === 'EXPENSE').forEach((item) => {
    const cents = Math.round(Number(item.amount || 0) * 100)
    if (cents <= 0) return
    const trendKey = resolveTrendKey(item.occurredOn, type, selectedRange, trend)
    const bucket = trendMap.get(trendKey)
    if (bucket) bucket.cents += cents
    const categoryId = item.categorySource === 'SYSTEM' ? item.systemCategoryId : item.categoryId
    const key = `${item.categorySource || 'CUSTOM'}:${categoryId || 'unknown'}`
    const category = categoryMap.get(key) || { key, name: categoryNames.get(key) || '已删除分类', cents: 0, count: 0 }
    category.cents += cents
    category.count += 1
    categoryMap.set(key, category)
    totalCents += cents
    count += 1
  })
  const total = totalCents / 100
  return {
    trend: trend.map(item => ({ ...item, amount: item.cents / 100 })),
    categories: Array.from(categoryMap.values()).sort((a, b) => b.cents - a.cents).map((item, index) => ({ ...item, rank: index + 1, amount: item.cents / 100, percent: totalCents ? item.cents * 100 / totalCents : 0 })),
    total,
    count
  }
}
function resolveTrendKey(occurredOn, type, selectedRange, trend) {
  if (type === 'YEAR') return occurredOn.slice(0, 7)
  if (type !== 'CUSTOM') return occurredOn
  const start = parseDate(selectedRange.startDate)
  const end = parseDate(selectedRange.endDate)
  const totalDays = Math.round((end - start) / 86400000) + 1
  if (totalDays > 90) return occurredOn.slice(0, 7)
  if (totalDays > 31) {
    // 按周：找到 occurredOn 落入的那个桶（桶 key 是周起始日）
    for (let i = trend.length - 1; i >= 0; i--) {
      if (occurredOn >= trend[i].key) return trend[i].key
    }
    return trend[0].key
  }
  return occurredOn
}
function createTrendBuckets(selectedRange, type) {
  if (type === 'YEAR') {
    const year = Number(selectedRange.startDate.slice(0, 4))
    return Array.from({ length: 12 }, (_, index) => ({ key: `${year}-${String(index + 1).padStart(2, '0')}`, label: `${index + 1}`, cents: 0 }))
  }
  const start = parseDate(selectedRange.startDate)
  const end = parseDate(selectedRange.endDate)
  const totalDays = Math.round((end - start) / 86400000) + 1
  // 自定义区间根据天数自动切换聚合粒度
  if (type === 'CUSTOM' && totalDays > 90) {
    // 按月聚合
    const buckets = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      buckets.push({ key, label: `${cursor.getMonth() + 1}`, cents: 0 })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return buckets
  }
  if (type === 'CUSTOM' && totalDays > 31) {
    // 按周聚合
    const buckets = []
    const cursor = new Date(start)
    let weekIndex = 1
    while (cursor <= end) {
      const weekStart = new Date(cursor)
      const weekEnd = new Date(cursor)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (weekEnd > end) weekEnd.setTime(end.getTime())
      const key = formatDate(weekStart)
      buckets.push({ key, label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`, cents: 0 })
      cursor.setDate(cursor.getDate() + 7)
      weekIndex++
    }
    return buckets
  }
  // 按日聚合
  const buckets = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = formatDate(cursor)
    const label = type === 'WEEK' ? `${cursor.getMonth() + 1}/${cursor.getDate()}` : `${cursor.getDate()}`
    buckets.push({ key, label, cents: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return buckets
}
function parseDate(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day) }
function pieColor(index) { return pieColors[index % pieColors.length] }

</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx 24rpx calc(48rpx + var(--window-bottom) + env(safe-area-inset-bottom)); background: #f5f7fb; box-sizing: border-box; }.filter-card,.card { margin: 0 0 24rpx; padding: 26rpx 28rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }.period-tabs { display: flex; gap: 10rpx; padding: 8rpx; border-radius: 16rpx; background: #f5f7fb; }.period-tab { flex: 1; padding: 14rpx 0; border-radius: 12rpx; color: #667085; font-size: 26rpx; text-align: center; }.period-tab.active { color: #1677ff; background: #fff; box-shadow: 0 3rpx 10rpx rgba(36, 58, 99, .1); font-weight: 600; }.range-control { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 2rpx 0; }.range-title,.range-detail { display: block; }.range-title { color: #1d2939; font-size: 30rpx; font-weight: 600; }.range-detail { margin-top: 8rpx; color: #98a2b3; font-size: 23rpx; }.range-arrow { color: #667085; font-size: 34rpx; }.custom-range { display: flex; align-items: center; gap: 12rpx; padding-top: 24rpx; }.custom-range picker { flex: 1; min-width: 0; }.date-field { padding: 16rpx; border-radius: 14rpx; background: #f7f8fa; }.date-field text { display: block; overflow: hidden; color: #344054; font-size: 23rpx; text-overflow: ellipsis; white-space: nowrap; }.date-field text:first-child { margin-bottom: 7rpx; color: #98a2b3; font-size: 20rpx; }.range-divider { color: #98a2b3; font-size: 23rpx; }.summary-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; padding: 30rpx; border-radius: 24rpx; color: #fff; background: linear-gradient(135deg, #1677ff, #5c9dff); box-shadow: 0 10rpx 28rpx rgba(22, 119, 255, .2); }.summary-label,.summary-amount,.summary-side text { display: block; }.summary-label,.summary-side text:first-child { color: rgba(255, 255, 255, .74); font-size: 24rpx; }.summary-amount { margin-top: 12rpx; font-size: 42rpx; font-weight: 600; }.summary-side { text-align: right; }.summary-side text:last-child { margin-top: 12rpx; font-size: 28rpx; font-weight: 600; }.card-header { display: flex; align-items: flex-start; justify-content: space-between; }.card-title,.card-subtitle { display: block; }.card-title { color: #1d2939; font-size: 30rpx; font-weight: 600; }.card-subtitle { margin-top: 7rpx; color: #98a2b3; font-size: 22rpx; }.peak-label,.total-count { padding: 8rpx 12rpx; border-radius: 12rpx; color: #1677ff; background: #eff6ff; font-size: 22rpx; }.trend-card { position: relative; }.trend-chart { display: flex; gap: 12rpx; margin-top: 24rpx; }.trend-y-axis { display: flex; flex: 0 0 68rpx; flex-direction: column; justify-content: space-between; height: 184rpx; padding: 1rpx 0; color: #98a2b3; font-size: 19rpx; line-height: 1; text-align: right; box-sizing: border-box; }.trend-plot-wrap { flex: 1; min-width: 0; }.trend-plot { position: relative; height: 184rpx; border-bottom: 1rpx solid #e9eff8; }.trend-grid-line { position: absolute; right: 0; left: 0; height: 1rpx; background: #e9eff8; }.grid-top { top: 0; }.grid-middle { top: 50%; }.grid-bottom { bottom: 0; }.trend-segment { position: absolute; z-index: 1; height: 4rpx; border-radius: 4rpx; background: #1677ff; transform-origin: left center; }.trend-point { position: absolute; z-index: 2; width: 12rpx; height: 12rpx; margin-bottom: -6rpx; margin-left: -6rpx; border: 3rpx solid #fff; border-radius: 50%; background: #1677ff; box-shadow: 0 2rpx 6rpx rgba(22, 119, 255, .25); box-sizing: border-box; }.trend-x-axis { position: relative; height: 34rpx; margin-top: 10rpx; }.trend-x-axis text { position: absolute; overflow: hidden; max-width: 68rpx; color: #98a2b3; font-size: 18rpx; line-height: 1; text-align: center; text-overflow: ellipsis; white-space: nowrap; transform: translateX(-50%); }.chart-empty { padding: 90rpx 0 54rpx; color: #98a2b3; font-size: 24rpx; text-align: center; }.pie-section { display: flex; align-items: center; gap: 18rpx; margin-top: 26rpx; }.pie-chart { position: relative; display: flex; flex: 0 0 260rpx; align-items: center; justify-content: center; width: 260rpx; height: 260rpx; border-radius: 50%; background: #1677ff; }.pie-chart.single-category { background: #1677ff; }.pie-hole { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 156rpx; height: 156rpx; border-radius: 50%; background: #fff; }.pie-hole text:first-child { color: #98a2b3; font-size: 20rpx; }.pie-hole text:last-child { margin-top: 8rpx; color: #1d2939; font-size: 23rpx; font-weight: 600; }.pie-legend { display: flex; flex: 1; flex-direction: column; gap: 16rpx; min-width: 0; }.legend-item { display: flex; align-items: center; gap: 10rpx; min-width: 0; }.legend-dot { flex: 0 0 14rpx; width: 14rpx; height: 14rpx; border-radius: 50%; }.legend-item view { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 8rpx; min-width: 0; }.legend-item text { overflow: hidden; color: #667085; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }.legend-item text:last-child { flex: 0 0 auto; color: #344054; font-weight: 500; }.category-list { margin-top: 24rpx; }.category-row + .category-row { margin-top: 25rpx; }.category-row-top,.category-row-bottom { display: flex; align-items: center; justify-content: space-between; }.category-row-top { color: #344054; font-size: 25rpx; font-weight: 500; }.category-name { display: flex; align-items: center; gap: 12rpx; }.rank-badge { display: flex; align-items: center; justify-content: center; width: 34rpx; height: 34rpx; border-radius: 50%; color: #1677ff; background: #eff6ff; font-size: 20rpx; }.progress-track { height: 13rpx; margin: 14rpx 0 9rpx; overflow: hidden; border-radius: 10rpx; background: #edf2f9; }.progress-value { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #1677ff, #69a7ff); }.category-row-bottom { color: #98a2b3; font-size: 21rpx; }.empty { padding: 65rpx 0 35rpx; color: #98a2b3; text-align: center; }.picker-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(16, 24, 40, .45); }.date-picker { width: 100%; min-height: 610rpx; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border-radius: 32rpx 32rpx 0 0; background: #fff; box-sizing: border-box; }.picker-handle { width: 72rpx; height: 8rpx; margin: 0 auto 30rpx; border-radius: 10rpx; background: #e4e7ec; }.picker-tabs { display: flex; justify-content: space-around; margin-bottom: 34rpx; }.picker-tab { position: relative; padding: 8rpx 16rpx; color: #98a2b3; font-size: 30rpx; }.picker-tab.active { color: #1d2939; font-weight: 600; }.picker-tab.active::after { position: absolute; right: 16rpx; bottom: 0; left: 16rpx; height: 5rpx; border-radius: 6rpx; background: #1677ff; content: ''; }.picker-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; }.nav-button { width: 70rpx; color: #1d2939; font-size: 68rpx; line-height: 1; text-align: center; }.picker-heading { color: #1d2939; font-size: 34rpx; font-weight: 600; }.date-grid { display: grid; grid-template-columns: repeat(3, 1fr); row-gap: 24rpx; }.date-cell { display: flex; align-items: center; justify-content: center; height: 76rpx; border-radius: 16rpx; color: #344054; font-size: 29rpx; }.date-cell.active { color: #fff; background: #1677ff; box-shadow: 0 8rpx 16rpx rgba(22, 119, 255, .22); }.week-list { display: flex; flex-direction: column; gap: 16rpx; max-height: 440rpx; overflow-y: auto; }.week-cell { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 24rpx; border-radius: 18rpx; color: #344054; background: #f7f8fa; font-size: 28rpx; }.week-cell text:last-child { color: #98a2b3; font-size: 22rpx; }.week-cell.active { color: #fff; background: #1677ff; }.week-cell.active text:last-child { color: rgba(255, 255, 255, .78); }
</style>
