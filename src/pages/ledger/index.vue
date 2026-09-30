<template>
  <view :class="['ledger-page', `theme-${themeStore.id}`]" :key="themeStore.id" :style="themeStore.pageStyle">
    <view class="hero hero-card">
      <view class="hero-top">
        <view class="hero-title-wrap">
          <image v-if="mascots" class="mini-cat" :src="mascots.mini" mode="aspectFit" />
          <text class="hero-title">{{ periodTitle }}</text>
        </view>
        <view class="hero-pill press" role="button" aria-label="切换统计周期" @click="openPicker">
          <text>{{ periodLabel }}</text>
          <u-icon name="arrow-down" size="11" color="rgba(255,255,255,.85)" />
        </view>
      </view>
      <view class="hero-balance">
        <text class="hero-balance-label">结余</text>
        <view class="hero-balance-row">
          <text class="hero-balance-currency">¥</text>
          <text class="hero-balance-num">{{ formatAmount(summary.netAmount) }}</text>
        </view>
      </view>
      <view class="hero-chips">
        <view class="hero-chip"><u-icon name="arrow-up" size="11" color="rgba(255,255,255,.85)" /><text>收入 {{ formatAmount(summary.incomeTotal) }}</text></view>
        <view class="hero-chip"><u-icon name="arrow-down" size="11" color="rgba(255,255,255,.85)" /><text>支出 {{ formatAmount(summary.expenseTotal) }}</text></view>
        <image v-if="mascots" class="hero-avatar" :src="mascots.avatar" mode="aspectFit" />
      </view>
    </view>

    <view class="list-head">
      <view class="list-title-main"><text class="list-title">流水明细</text><image v-if="mascots" class="title-paw" :src="mascots.watermelon" mode="aspectFit" /><text class="list-count">{{ transactions.length }} 笔</text></view>
      <text class="list-hint">轻按编辑 · 长按删除</text>
    </view>
    <view v-if="loading" class="empty">加载中…</view><view v-else-if="!transactions.length" class="empty"><image v-if="mascots" class="empty-cat" :src="mascots.empty" mode="aspectFit" /><text>{{ mascots ? '喵呜，这个时间段还没有流水' : '这个时间段还没有流水' }}</text></view>
    <view v-else class="day-groups"><view v-for="group in transactionGroups" :key="group.date" class="day-group"><view class="day-header"><view class="day-label-wrap"><image v-if="mascots" class="day-paw" :src="mascots.cherry" mode="aspectFit" /><text class="day-label">{{ group.label }}</text></view><view class="day-meta"><text class="day-date">{{ group.date }}</text><text v-if="group.incomeTotal > 0" class="day-total income">+{{ formatAmount(group.incomeTotal) }}</text><text v-if="group.expenseTotal > 0" class="day-total expense">-{{ formatAmount(group.expenseTotal) }}</text></view></view><view class="transaction-list"><view v-for="item in group.items" :key="item.id" class="transaction-item press" @click="goEdit(item)" @longpress="remove(item)"><view class="icon"><image v-if="getCategoryImage(item)" class="icon-image" :src="getCategoryImage(item)" mode="aspectFill" /><category-icon v-else :name="getCategoryName(item)" :type="item.transactionType" :icon-key="getCategoryIconKey(item)" :size="42" /></view><view class="item-main"><text class="item-name">{{ categoryName(item) }}</text><text class="item-note">{{ item.note || '暂无备注' }}</text></view><text :class="['item-amount', item.transactionType === 'INCOME' ? 'income' : 'expense']">{{ item.transactionType === 'INCOME' ? '+' : '-' }}{{ formatAmount(item.amount) }}</text></view></view></view><view v-if="mascots" class="ledger-cat-footer"><image :src="mascots.footer" mode="aspectFit" /><text>喵，这个期间的账都翻完啦～</text></view></view>
    <view class="add-fab" aria-label="记一笔" role="button" @click="goCreate"><u-icon name="plus" color="#ffffff" size="26" /></view>

    <custom-tab-bar />

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
import { formatAmount, formatDayLabel, monthRange, weekRangesInMonth, yearRange, dateParts } from '../../utils/date'
import { showRequestError } from '../../utils/request'
import { themeStore } from '../../stores/theme'
import { buildCategoryMap, resolveCategory } from '../../utils/category-icon'
import CategoryIcon from '../../category-icon/index.vue'
import CustomTabBar from '../../custom-tab-bar/index.vue'

const range = reactive(monthRange())
// 猫咪主题：mascots 存在即进入猫咪模式
const mascots = computed(() => themeStore.currentTheme.mascots || null)
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
let requestId = 0
// 按时间区间缓存上次数据：再次进入先秒显缓存（SWR），30 秒内直接跳过后台请求
const CACHE_TTL = 30 * 1000
const ledgerCache = new Map()
const categoryMap = computed(() => buildCategoryMap(categories.value))
const periodLabel = computed(() => pickerModes.find((mode) => mode.value === periodType.value)?.label || '按月')
const transactionGroups = computed(() => {
  const groups = new Map()
  transactions.value.forEach((item) => {
    if (!groups.has(item.occurredOn)) groups.set(item.occurredOn, [])
    groups.get(item.occurredOn).push(item)
  })
  return Array.from(groups, ([date, items]) => ({
    date,
    items,
    label: formatDayLabel(date),
    incomeTotal: items.filter(item => item.transactionType === 'INCOME').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    expenseTotal: items.filter(item => item.transactionType !== 'INCOME').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  }))
})
const years = computed(() => Array.from({ length: 12 }, (_, index) => pickerYear.value - 11 + index))
const weeks = computed(() => weekRangesInMonth(pickerYear.value, pickerMonth.value))
const pickerHeading = computed(() => pickerMode.value === 'WEEK' ? `${pickerYear.value}年${pickerMonth.value + 1}月` : `${pickerYear.value}年`)
const periodTitle = computed(() => {
  if (periodType.value === 'YEAR') return `${range.startDate.slice(0, 4)}年账本`
  if (periodType.value === 'MONTH') return `${range.startDate.slice(0, 4)}年${Number(range.startDate.slice(5, 7))}月账本`
  // 按周：展示所属月份与当月第几周，不展示具体日期区间
  const date = dateParts(range.startDate)
  const weeksOfMonth = weekRangesInMonth(date.year, date.month)
  const index = weeksOfMonth.findIndex((week) => week.startDate === range.startDate)
  return `${date.year}年${date.month + 1}月第${(index >= 0 ? index : 0) + 1}周账本`
})

onShow(load)
// 数据变更（流水/分类增删改）→ 标记过期：返回时先秒显旧数据，后台刷新后自动更新；hard（登录切换）→ 整体清空
uni.$on('ledger:invalidate', ({ hard } = {}) => {
  if (hard) ledgerCache.clear()
  else for (const entry of ledgerCache.values()) entry.fetchedAt = 0
})
async function load({ force = false } = {}) {
  const cacheKey = `${periodType.value}|${range.startDate}|${range.endDate}`
  const cached = ledgerCache.get(cacheKey)
  if (cached && !force) {
    categories.value = cached.categories
    transactions.value = cached.transactions
    Object.assign(summary, cached.summary)
    if (Date.now() - cached.fetchedAt < CACHE_TTL) return
  }
  const currentRequest = ++requestId
  if (!cached) loading.value = true
  try {
    const [categoryData, transactionData, summaryData] = await Promise.all([appApi.listCategories(), appApi.listTransactions(range), appApi.getSummary(range)])
    if (currentRequest !== requestId) return
    categories.value = categoryData
    transactions.value = transactionData
    Object.assign(summary, summaryData)
    ledgerCache.set(cacheKey, { categories: categoryData, transactions: transactionData, summary: { ...summaryData }, fetchedAt: Date.now() })
  } catch (error) {
    if (currentRequest === requestId) showRequestError(error)
  } finally { if (currentRequest === requestId) loading.value = false }
}

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
function categoryName(item) { const cat = resolveCategory(item, categoryMap.value); return cat?.name || '分类已停用或删除' }
function getCategoryName(item) { const cat = resolveCategory(item, categoryMap.value); return cat?.name || '' }
function getCategoryImage(item) { const cat = resolveCategory(item, categoryMap.value); return cat?.imageUrl || '' }
function getCategoryIconKey(item) { const cat = resolveCategory(item, categoryMap.value); return cat?.iconKey || '' }
function goCreate() { uni.navigateTo({ url: '/pages/ledger/transaction-form' }) }
function goEdit(item) { uni.navigateTo({ url: `/pages/ledger/transaction-form?id=${item.id}` }) }
function remove(item) { uni.showModal({ title: '删除流水', content: '删除后无法恢复，确定继续吗？', success: async ({ confirm }) => { if (!confirm) return; try { await appApi.deleteTransaction(item.id); await load({ force: true }); uni.showToast({ title: '已删除', icon: 'success' }) } catch (error) { showRequestError(error) } } }) }
</script>

<style scoped>
.ledger-page { min-height: 100vh; padding-top: var(--status-bar-height, 0); background: var(--theme-page-bg); box-sizing: border-box; }

/* 主视觉：周期 + 结余 + 收支概览合并为一张渐变 Hero 卡，高光由全局 .hero::after 提供 */
.hero-card { margin: 24rpx 24rpx 8rpx; padding: 30rpx 32rpx 34rpx; border-radius: calc(var(--theme-radius-card) + 10rpx); box-shadow: var(--elev-3); }
.hero-top { display: flex; align-items: center; justify-content: space-between; }
.hero-title-wrap { display: flex; align-items: center; min-width: 0; }
.mini-cat { width: 52rpx; height: 52rpx; margin-right: 14rpx; flex-shrink: 0; }
.hero-title { overflow: hidden; font-size: var(--font-md); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.hero-pill { display: flex; align-items: center; gap: 6rpx; padding: 10rpx 22rpx; border: 1rpx solid rgba(255, 255, 255, .35); border-radius: 999rpx; background: rgba(255, 255, 255, .18); font-size: var(--font-caption); flex-shrink: 0; }
.hero-balance { margin-top: 36rpx; }
.hero-balance-label { color: rgba(255, 255, 255, .72); font-size: var(--font-caption); }
.hero-balance-row { display: flex; align-items: baseline; gap: 6rpx; margin-top: 6rpx; }
.hero-balance-currency { font-size: 30rpx; font-weight: 500; }
.hero-balance-num { font-size: var(--font-hero); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .5rpx; }
.hero-chips { display: flex; align-items: center; gap: 14rpx; margin-top: 30rpx; }
.hero-chip { display: flex; align-items: center; gap: 8rpx; padding: 10rpx 22rpx; border-radius: 999rpx; background: rgba(255, 255, 255, .16); font-size: var(--font-caption); font-variant-numeric: tabular-nums; }
.hero-avatar { width: 76rpx; height: 76rpx; margin-left: auto; padding: 6rpx; box-sizing: border-box; border-radius: 50%; background: rgba(255, 255, 255, .92); box-shadow: 0 4rpx 14rpx rgba(93, 58, 21, .18); flex-shrink: 0; }

/* 列表：日头吸顶，行内图标改圆角方形，金额右对齐 */
.day-groups { padding: 8rpx 24rpx calc(150rpx + var(--tab-bar-height, var(--window-bottom)) + env(safe-area-inset-bottom)); }
.list-head { display: flex; align-items: baseline; justify-content: space-between; margin: 0 24rpx; padding: 28rpx 6rpx 14rpx; }
.list-title-main { display: flex; align-items: center; }
.list-title { color: var(--theme-text); font-size: var(--font-md); font-weight: 600; }
.list-count { margin-left: 12rpx; color: var(--theme-text-muted); font-size: var(--font-caption); }
.title-paw { width: 32rpx; height: 32rpx; margin-left: 8rpx; }
.list-hint { color: var(--theme-text-muted); font-size: var(--font-caption); }
.day-group { margin-bottom: 30rpx; }
.day-header { position: sticky; top: var(--status-bar-height, 0px); z-index: 5; display: flex; align-items: center; justify-content: space-between; padding: 12rpx 6rpx; background: var(--theme-page-bg); }
.day-label-wrap { display: flex; align-items: center; }
.day-paw { width: 30rpx; height: 30rpx; margin-right: 10rpx; }
.day-label { color: var(--theme-text); font-size: var(--font-body); font-weight: 600; }
.day-meta { display: flex; align-items: center; gap: 12rpx; }
.day-date { color: var(--theme-text-muted); font-size: var(--font-caption); }
.day-total { font-size: var(--font-caption); font-weight: 500; font-variant-numeric: tabular-nums; }
.transaction-list { overflow: hidden; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-2); border: 1rpx solid var(--theme-border); }
.transaction-item { display: flex; align-items: center; min-height: 122rpx; padding: 0 24rpx; border-bottom: 1rpx solid var(--theme-border); }
.transaction-item:last-child { border-bottom: 0; }
.icon { display: flex; align-items: center; justify-content: center; width: 72rpx; height: 72rpx; flex-shrink: 0; overflow: hidden; border-radius: 24rpx; background: var(--theme-primary-soft); }
.icon-image { width: 100%; height: 100%; }
.item-main { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 6rpx; margin-left: 20rpx; }
.item-name { overflow: hidden; color: var(--theme-text-strong); font-size: var(--font-md); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.item-note { overflow: hidden; color: var(--theme-text-muted); font-size: var(--font-caption); text-overflow: ellipsis; white-space: nowrap; }
.item-amount { flex-shrink: 0; margin-left: 16rpx; font-size: var(--font-md); font-weight: 600; font-variant-numeric: tabular-nums; }
.income { color: var(--theme-income); }
.expense { color: var(--theme-expense); }

/* 空态与猫咪页脚 */
.empty { display: flex; flex-direction: column; align-items: center; gap: 6rpx; margin: 16rpx 24rpx 0; padding: 48rpx 30rpx; border-radius: var(--theme-radius-card); background: var(--theme-surface); color: var(--theme-text-muted); box-shadow: var(--elev-2); font-size: var(--font-body); }
.empty-cat { width: 170rpx; height: 170rpx; }
.ledger-cat-footer { display: flex; flex-direction: column; align-items: center; gap: 10rpx; margin: 16rpx 0 0; padding: 34rpx 30rpx 30rpx; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-2); }
.ledger-cat-footer image { width: 150rpx; height: 150rpx; }
.ledger-cat-footer text { color: var(--theme-text-muted); font-size: var(--font-caption); }

/* 新增按钮 */
.add-fab { position: fixed; z-index: 20; bottom: calc(28rpx + var(--tab-bar-height, var(--window-bottom)) + env(safe-area-inset-bottom)); left: 50%; display: flex; align-items: center; justify-content: center; width: 108rpx; height: 108rpx; border: 8rpx solid var(--theme-page-bg); border-radius: 50%; color: var(--theme-on-primary); background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); box-shadow: var(--elev-3); transform: translateX(-50%); transition: transform .15s ease; }
.add-fab:active { transform: translateX(-50%) scale(.92); }

/* 周期选择弹层 */
.picker-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .5); }
.date-picker { width: 100%; min-height: 610rpx; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border-radius: 36rpx 36rpx 0 0; background: var(--theme-surface); box-shadow: var(--elev-3); box-sizing: border-box; overscroll-behavior: contain; }
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
.picker-tab:active, .date-cell:active, .week-cell:active { opacity: .7; }
</style>
