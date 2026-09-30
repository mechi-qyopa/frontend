<template>
  <view :class="['page', `theme-${themeStore.id}`]" :key="themeStore.id" :style="themeStore.pageStyle">
    <view class="filter-card">
      <view class="period-tabs">
        <text v-for="item in periodOptions" :key="item.value" :class="['period-tab', { active: periodType === item.value }]" @click="setPeriodType(item.value)">{{ item.label }}</text>
      </view>
      <view v-if="periodType === 'CUSTOM'" class="custom-range">
        <picker mode="date" :value="range.startDate" @change="selectCustomStart"><view class="date-field"><text>开始日期</text><text>{{ range.startDate }}</text></view></picker>
        <text class="range-divider">至</text>
        <picker mode="date" :value="range.endDate" @change="selectCustomEnd"><view class="date-field"><text>结束日期</text><text>{{ range.endDate }}</text></view></picker>
      </view>
      <view v-else class="range-control press" @click="openPicker"><view class="range-info"><image v-if="mascots" class="mini-cat" :src="mascots.smug" mode="aspectFit" /><text class="range-title">{{ periodTitle }}</text></view><view class="range-actions"><u-icon name="arrow-down" size="12" /></view></view>
    </view>

    <view class="hero summary-card">
      <view class="summary-main"><text class="summary-label">区间总支出</text><view class="summary-amount-row"><text class="summary-currency">¥</text><text class="summary-amount">{{ formatAmount(expenseTotal) }}</text></view></view>
      <view class="summary-side"><text>{{ trendUnitLabel }}均支出</text><text>¥ {{ formatAmount(averageExpense) }}</text></view>
      <image v-if="mascots" class="summary-avatar" :src="mascots.shock" mode="aspectFit" />
    </view>

    <view class="card trend-card">
      <view class="card-header"><view class="card-title-wrap"><image v-if="mascots" class="card-paw" :src="mascots.fork" mode="aspectFit" /><view><text class="card-title">支出趋势</text><text class="card-subtitle">{{ trendUnitLabel }}统计</text></view></view><text class="peak-label">最高 ¥ {{ formatAmount(peakAmount) }}</text></view>
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
      <view v-else-if="!loading" class="chart-empty"><image v-if="mascots" class="empty-cat" :src="mascots.empty" mode="aspectFit" /><text>{{ mascots ? '喵呜，该区间暂无支出记录' : '该区间暂无支出记录' }}</text></view>
    </view>

    <view class="card category-card">
      <view class="card-header"><view class="card-title-wrap"><image v-if="mascots" class="card-paw" :src="mascots.note" mode="aspectFit" /><view><text class="card-title">支出占比</text><text class="card-subtitle">按分类汇总</text></view></view><text class="total-count">{{ expenseTransactions }} 笔</text></view>
      <view v-if="categoryStats.length" class="pie-section"><view :class="['pie-chart', { 'single-category': categoryStats.length === 1 }]" :style="pieChartStyle"><view class="pie-hole"><text>总支出</text><text>¥ {{ formatAmount(expenseTotal) }}</text></view></view><view class="pie-legend"><view v-for="segment in pieSegments" :key="segment.key" class="legend-item press" @click="goCategoryDetail(segment.detail)"><text class="legend-dot" :style="{ background: segment.color }" /><view><text>{{ segment.name }}</text><text>{{ segment.percent.toFixed(1) }}%</text></view></view></view></view>
      <view v-if="categoryStats.length" class="category-list"><view v-for="item in categoryStats" :key="item.key" class="category-row press" @click="goCategoryDetail(item)"><view class="category-row-top"><view class="category-name"><text class="rank-badge">{{ item.rank }}</text><text>{{ item.name }}</text></view><text>¥ {{ formatAmount(item.amount) }}</text></view><view class="progress-track"><view class="progress-value" :style="{ width: `${item.percent}%` }" /></view><view class="category-row-bottom"><text>{{ item.count }} 笔</text><text>{{ item.percent.toFixed(1) }}%</text></view></view></view>
      <view v-else-if="!loading" class="empty"><image v-if="mascots" class="empty-cat" :src="mascots.empty" mode="aspectFit" /><text>{{ mascots ? '喵呜，该区间暂无支出分类' : '该区间暂无支出分类' }}</text></view><view v-else class="empty">加载中…</view>
    </view>

    <view v-if="mascots" class="ledger-cat-footer"><image :src="mascots.cake" mode="aspectFit" /><text>喵，{{ periodTitle }}的支出都看完啦～</text></view>

    <custom-tab-bar />
  </view>

  <view v-if="pickerVisible" :key="themeStore.id" class="picker-mask" :style="themeStore.cssVariables" @click.self="closePicker">
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
import { computed, nextTick, reactive, ref } from 'vue'
import { onReady, onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatAmount, formatDate, monthRange, weekRange, weekRangesInMonth, yearRange } from '../../utils/date'
import { showRequestError } from '../../utils/request'
import { themeStore } from '../../stores/theme'
import CustomTabBar from '../../custom-tab-bar/index.vue'

const range = reactive(monthRange())
// 猫咪主题：mascots 存在即进入猫咪模式
const mascots = computed(() => themeStore.currentTheme.mascots || null)
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
const pieColors = computed(() => themeStore.currentTheme.colors.chart)
// getSystemInfoSync 已废弃，改用 getWindowInfo
const screenWidth = uni.getWindowInfo().windowWidth || 375
// 折线图坐标基于容器实际宽高：先给 rpx 换算兜底值，挂载后实测修正（不同屏宽/边距下按比例硬编码会错位）
const trendPlotPadding = screenWidth * 12 / 750
const trendPlotWidth = ref(screenWidth * 566 / 750)
const trendPlotHeight = ref(screenWidth * 184 / 750)
let requestId = 0

const years = computed(() => Array.from({ length: 12 }, (_, index) => pickerYear.value - 11 + index))
const weeks = computed(() => weekRangesInMonth(pickerYear.value, pickerMonth.value))
const pickerHeading = computed(() => pickerMode.value === 'WEEK' ? `${pickerYear.value}年${pickerMonth.value + 1}月` : `${pickerYear.value}年`)
// 周期标题与首页口径一致：只说到周/月/年，不展示具体日期区间（自定义除外）
const periodTitle = computed(() => {
  if (periodType.value === 'CUSTOM') return '自定义区间'
  if (periodType.value === 'WEEK') {
    const date = parseDate(range.startDate)
    const weeksOfMonth = weekRangesInMonth(date.getFullYear(), date.getMonth())
    const index = weeksOfMonth.findIndex((week) => week.startDate === range.startDate)
    return `${date.getFullYear()}年${date.getMonth() + 1}月第${(index >= 0 ? index : 0) + 1}周`
  }
  if (periodType.value === 'YEAR') return `${range.startDate.slice(0, 4)}年`
  return `${range.startDate.slice(0, 4)}年${Number(range.startDate.slice(5, 7))}月`
})
const trendUnitLabel = computed(() => periodType.value === 'YEAR' ? '按月' : '按日')
const peakAmount = computed(() => Math.max(0, ...trendData.value.map(item => item.amount)))
const averageExpense = computed(() => expenseTotal.value / Math.max(1, trendData.value.length))
const trendPoints = computed(() => {
  const data = trendData.value
  const max = Math.max(1, ...data.map(item => item.amount))
  const innerWidth = Math.max(1, trendPlotWidth.value - trendPlotPadding * 2)
  const innerHeight = Math.max(1, trendPlotHeight.value - trendPlotPadding * 2)
  return data.map((item, index) => {
    const ratio = data.length === 1 ? .5 : index / (data.length - 1)
    const x = trendPlotPadding + innerWidth * ratio
    const y = trendPlotPadding + innerHeight * item.amount / max
    return { key: item.key, label: item.label, x, y, style: { left: `${x}px`, bottom: `${y}px` }, labelStyle: { left: `${x / trendPlotWidth.value * 100}%` } }
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
// 环形图只画前 4 个分类，其余合并为「其余 N 类」：避免尾部细缝看似缺口，也保证图例与扇形一一对应
const PIE_LEGEND_LIMIT = 4
const pieSegments = computed(() => {
  const stats = categoryStats.value
  if (!stats.length) return []
  const top = stats.slice(0, PIE_LEGEND_LIMIT).map((item, index) => ({ key: item.key, name: item.name, percent: item.percent, color: pieColor(index), detail: item }))
  const rest = stats.slice(PIE_LEGEND_LIMIT)
  if (!rest.length) return top
  const restPercent = rest.reduce((sum, item) => sum + item.percent, 0)
  return [...top, { key: '__rest__', name: `其余${rest.length}类`, percent: restPercent, color: themeStore.currentTheme.colors.textMuted, detail: null }]
})
const pieChartStyle = computed(() => {
  if (pieSegments.value.length <= 1) return {}
  let offset = 0
  const segments = pieSegments.value.map((segment) => {
    const start = offset
    offset += segment.percent
    return `${segment.color} ${start}% ${offset}%`
  })
  return { backgroundImage: `conic-gradient(${segments.join(', ')})` }
})

onShow(load)
onReady(measureTrendPlot)
// 数据渲染后实测 .trend-plot 尺寸，修正按屏宽比例估算的兜底值
function measureTrendPlot() {
  uni.createSelectorQuery().select('.trend-plot').boundingClientRect((rect) => {
    if (rect?.width && rect?.height) {
      trendPlotWidth.value = rect.width
      trendPlotHeight.value = rect.height
    }
  }).exec()
}
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
    if (currentRequest === requestId) {
      loading.value = false
      nextTick(measureTrendPlot)
    }
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
function goCategoryDetail(item) {
  if (!item || item.categoryId === null || item.categoryId === undefined) return
  const params = [
    `categorySource=${encodeURIComponent(item.categorySource)}`,
    `categoryId=${encodeURIComponent(item.categoryId)}`,
    `startDate=${encodeURIComponent(range.startDate)}`,
    `endDate=${encodeURIComponent(range.endDate)}`,
    `name=${encodeURIComponent(item.name)}`
  ].join('&')
  uni.navigateTo({ url: `/pages/ledger/category-transactions?${params}` })
}

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
    const categorySource = item.categorySource || 'CUSTOM'
    const categoryId = categorySource === 'SYSTEM' ? item.systemCategoryId : item.categoryId
    const key = `${categorySource}:${categoryId || 'unknown'}`
    const category = categoryMap.get(key) || { key, categorySource, categoryId, name: categoryNames.get(key) || '已删除分类', cents: 0, count: 0 }
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
function pieColor(index) { return pieColors.value[index % pieColors.value.length] }

</script>

<style scoped>
.page { min-height: 100vh; padding: calc(24rpx + var(--status-bar-height, 0)) 24rpx calc(48rpx + var(--tab-bar-height, var(--window-bottom)) + env(safe-area-inset-bottom)); background: var(--theme-page-bg); box-sizing: border-box; }
.filter-card, .card { margin: 0 0 24rpx; padding: 26rpx 28rpx; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-2); border: 1rpx solid var(--theme-border); }

/* 周期筛选：胶囊分段 + 范围入口 */
.period-tabs { display: flex; gap: 6rpx; padding: 6rpx; border-radius: 999rpx; background: var(--theme-page-bg); border: 1rpx solid var(--theme-border); }
.period-tab { flex: 1; padding: 14rpx 0; border-radius: 999rpx; color: var(--theme-text-secondary); font-size: var(--font-body); text-align: center; transition: color .2s ease; }
.period-tab.active { color: var(--theme-primary); background: var(--theme-surface); box-shadow: var(--elev-1); font-weight: 600; }
.range-control { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 2rpx 0; }
.range-info { display: flex; align-items: center; min-width: 0; }
.mini-cat { width: 52rpx; height: 52rpx; margin-right: 14rpx; flex-shrink: 0; }
.range-title { overflow: hidden; color: var(--theme-text); font-size: var(--font-md); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.range-actions { display: flex; align-items: center; justify-content: center; width: 56rpx; height: 56rpx; border-radius: 18rpx; color: var(--theme-primary); background: var(--theme-primary-soft); flex-shrink: 0; }
.custom-range { display: flex; align-items: center; gap: 12rpx; padding-top: 24rpx; }
.custom-range picker { flex: 1; min-width: 0; }
.date-field { padding: 16rpx; border-radius: 14rpx; background: var(--theme-page-bg); }
.date-field text { display: block; overflow: hidden; color: var(--theme-text-strong); font-size: var(--font-caption); text-overflow: ellipsis; white-space: nowrap; }
.date-field text:first-child { margin-bottom: 7rpx; color: var(--theme-text-muted); font-size: 20rpx; }
.range-divider { color: var(--theme-text-muted); font-size: var(--font-caption); }

/* 汇总 Hero：区间总支出为主角，均值副信息靠右 */
.summary-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; padding: 30rpx 32rpx; border-radius: calc(var(--theme-radius-card) + 10rpx); box-shadow: var(--elev-3); }
.summary-label { display: block; color: rgba(255, 255, 255, .72); font-size: var(--font-caption); }
.summary-amount-row { display: flex; align-items: baseline; gap: 6rpx; margin-top: 12rpx; }
.summary-currency { color: rgba(255, 255, 255, .85); font-size: 28rpx; font-weight: 500; }
.summary-amount { font-size: 48rpx; font-weight: 700; font-variant-numeric: tabular-nums; }
.summary-side { text-align: right; }
.summary-side text { display: block; }
.summary-side text:first-child { color: rgba(255, 255, 255, .72); font-size: var(--font-caption); }
.summary-side text:last-child { margin-top: 12rpx; font-size: 28rpx; font-weight: 600; font-variant-numeric: tabular-nums; }
.summary-avatar { width: 88rpx; height: 88rpx; margin-left: 8rpx; padding: 8rpx; box-sizing: border-box; border-radius: 50%; background: rgba(255, 255, 255, .92); flex-shrink: 0; box-shadow: 0 4rpx 14rpx rgba(93, 58, 21, .2); }

/* 卡片头 */
.card-header { display: flex; align-items: flex-start; justify-content: space-between; }
.card-title-wrap { display: flex; align-items: center; }
.card-paw { width: 30rpx; height: 30rpx; margin-right: 10rpx; }
.card-title { display: block; color: var(--theme-text); font-size: var(--font-md); font-weight: 600; }
.card-subtitle { display: block; margin-top: 7rpx; color: var(--theme-text-muted); font-size: var(--font-caption); }
.peak-label, .total-count { padding: 8rpx 14rpx; border-radius: 999rpx; color: var(--theme-primary); background: var(--theme-primary-soft); font-size: var(--font-caption); font-variant-numeric: tabular-nums; }

/* 折线图 */
.trend-card { position: relative; }
.trend-chart { display: flex; gap: 12rpx; margin-top: 24rpx; }
.trend-y-axis { display: flex; flex: 0 0 68rpx; flex-direction: column; justify-content: space-between; height: 184rpx; padding: 1rpx 0; color: var(--theme-text-muted); font-size: 19rpx; line-height: 1; text-align: right; box-sizing: border-box; }
.trend-plot-wrap { flex: 1; min-width: 0; }
.trend-plot { position: relative; height: 184rpx; border-bottom: 1rpx solid var(--theme-border); }
.trend-grid-line { position: absolute; right: 0; left: 0; height: 1rpx; background: var(--theme-border); }
.grid-top { top: 0; }
.grid-middle { top: 50%; }
.grid-bottom { bottom: 0; }
.trend-segment { position: absolute; z-index: 1; height: 4rpx; border-radius: 4rpx; background: var(--theme-primary); transform-origin: left center; }
.trend-point { position: absolute; z-index: 2; width: 12rpx; height: 12rpx; margin-bottom: -6rpx; margin-left: -6rpx; border: 3rpx solid var(--theme-surface); border-radius: 50%; background: var(--theme-primary); box-shadow: 0 2rpx 6rpx var(--theme-primary-shadow); box-sizing: border-box; }
.trend-x-axis { position: relative; height: 34rpx; margin-top: 10rpx; }
.trend-x-axis text { position: absolute; overflow: hidden; max-width: 68rpx; color: var(--theme-text-muted); font-size: 18rpx; line-height: 1; text-align: center; text-overflow: ellipsis; white-space: nowrap; transform: translateX(-50%); }
.chart-empty { display: flex; flex-direction: column; align-items: center; padding: 90rpx 0 54rpx; color: var(--theme-text-muted); font-size: var(--font-body); text-align: center; }

/* 占比饼图与分类排行 */
.pie-section { display: flex; align-items: center; gap: 18rpx; margin-top: 26rpx; }
.pie-chart { position: relative; display: flex; flex: 0 0 260rpx; align-items: center; justify-content: center; width: 260rpx; height: 260rpx; border-radius: 50%; background: var(--theme-primary); }
.pie-hole { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 156rpx; height: 156rpx; border-radius: 50%; background: var(--theme-surface); }
.pie-hole text:first-child { color: var(--theme-text-muted); font-size: 20rpx; }
.pie-hole text:last-child { margin-top: 8rpx; color: var(--theme-text); font-size: var(--font-caption); font-weight: 600; font-variant-numeric: tabular-nums; }
.pie-legend { display: flex; flex: 1; flex-direction: column; gap: 16rpx; min-width: 0; }
.legend-item { display: flex; align-items: center; gap: 10rpx; min-width: 0; }
.legend-dot { flex: 0 0 14rpx; width: 14rpx; height: 14rpx; border-radius: 50%; }
.legend-item view { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 8rpx; min-width: 0; }
.legend-item text { overflow: hidden; color: var(--theme-text-muted); font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.legend-item text:last-child { flex: 0 0 auto; color: var(--theme-text-strong); font-weight: 500; }
.category-list { margin-top: 24rpx; }
.category-row + .category-row { margin-top: 25rpx; }
.category-row-top, .category-row-bottom { display: flex; align-items: center; justify-content: space-between; }
.category-row-top { color: var(--theme-text-strong); font-size: 25rpx; font-weight: 500; font-variant-numeric: tabular-nums; }
.category-name { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.category-name text:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-badge { display: flex; align-items: center; justify-content: center; width: 34rpx; height: 34rpx; border-radius: 50%; color: var(--theme-primary); background: var(--theme-primary-soft); font-size: 20rpx; }
.progress-track { height: 13rpx; margin: 14rpx 0 9rpx; overflow: hidden; border-radius: 10rpx; background: var(--theme-primary-soft); }
.progress-value { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--theme-primary), var(--theme-primary-end)); }
.category-row-bottom { color: var(--theme-text-muted); font-size: 21rpx; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 65rpx 0 35rpx; color: var(--theme-text-muted); text-align: center; }
.empty-cat { width: 170rpx; height: 170rpx; margin-bottom: 8rpx; }

/* 周期选择弹层 */
.picker-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .5); }
.date-picker { width: 100%; min-height: 610rpx; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border-radius: 36rpx 36rpx 0 0; background: var(--theme-surface); box-shadow: var(--elev-3); box-sizing: border-box; }
.picker-handle { width: 72rpx; height: 8rpx; margin: 0 auto 30rpx; border-radius: 999rpx; background: var(--theme-border); }
.picker-tabs { display: flex; justify-content: space-around; margin-bottom: 34rpx; }
.picker-tab { position: relative; padding: 8rpx 16rpx; color: var(--theme-text-muted); font-size: var(--font-md); }
.picker-tab.active { color: var(--theme-text); font-weight: 600; }
.picker-tab.active::after { position: absolute; right: 16rpx; bottom: 0; left: 16rpx; height: 6rpx; border-radius: 999rpx; background: var(--theme-primary); content: ''; }
.picker-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; }
.nav-button { width: 70rpx; color: var(--theme-text); font-size: 64rpx; line-height: 1; text-align: center; }
.picker-heading { color: var(--theme-text); font-size: 34rpx; font-weight: 600; }
.date-grid { display: grid; grid-template-columns: repeat(3, 1fr); row-gap: 24rpx; }
.date-cell { display: flex; align-items: center; justify-content: center; height: 76rpx; border-radius: 16rpx; color: var(--theme-text-strong); font-size: 29rpx; }
.date-cell.active { color: var(--theme-on-primary); background: var(--theme-primary); box-shadow: 0 8rpx 16rpx var(--theme-primary-shadow); }
.week-list { display: flex; flex-direction: column; gap: 16rpx; max-height: 440rpx; overflow-y: auto; overscroll-behavior: contain; }
.week-cell { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 24rpx; border-radius: 18rpx; color: var(--theme-text-strong); background: var(--theme-page-bg); font-size: var(--font-body); }
.week-cell text:last-child { color: var(--theme-text-muted); font-size: 22rpx; }
.week-cell.active { color: var(--theme-on-primary); background: var(--theme-primary); }
.week-cell.active text:last-child { color: rgba(255, 255, 255, .78); }

/* 猫咪页脚 */
.ledger-cat-footer { display: flex; flex-direction: column; align-items: center; gap: 10rpx; margin-top: 8rpx; padding: 34rpx 30rpx 30rpx; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-2); }
.ledger-cat-footer image { width: 150rpx; height: 150rpx; }
.ledger-cat-footer text { color: var(--theme-text-muted); font-size: var(--font-caption); }

/* 按压态 */
.period-tab:active, .picker-tab:active, .nav-button:active, .date-cell:active, .week-cell:active { opacity: .7; }
</style>
