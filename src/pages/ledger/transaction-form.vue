<template>
  <view class="page" :style="themeStore.cssVariables">
    <view class="book-header">
      <view class="back-button" aria-label="返回" role="button" @click="goBack" />
      <view class="book-title"><text>{{ editingId ? '编辑流水' : '默认账本' }}</text><text class="book-subtitle">{{ editingId ? '修改金额、备注或分类' : (mascots ? '记录每一笔收支喵～' : '记录每一笔收支') }}</text></view>
      <image v-if="headerCat" class="book-icon-image" :src="headerCat" mode="aspectFit" />
      <view v-else class="book-icon"><u-icon name="edit-pen" size="22" /></view>
    </view>

    <view class="type-switch">
      <view class="type-indicator" :class="{ 'indicator-right': form.transactionType === 'INCOME' }" />
      <view :class="['type', { active: form.transactionType === 'EXPENSE' }]" role="button" aria-label="记支出" @click="selectType('EXPENSE')"><text>支出</text></view>
      <view :class="['type', { active: form.transactionType === 'INCOME' }]" role="button" aria-label="记收入" @click="selectType('INCOME')"><text>收入</text></view>
    </view>

    <view class="category-section">
      <swiper v-if="categoryPages.length" class="category-swiper" :current="currentCategoryPage" @change="onCategoryPageChange">
        <swiper-item v-for="(page, pageIndex) in categoryPages" :key="pageIndex">
          <view class="category-grid">
            <view v-for="item in page" :key="`${item.source}-${item.id}`" :class="['category-item', { selected: isSelectedCategory(item) }]" @click="selectCategory(item)">
              <view class="category-icon"><category-icon :name="item.name" :type="form.transactionType" :icon-key="item.iconKey || ''" :size="46" :color="isSelectedCategory(item) ? themeStore.currentTheme.colors.primary : ''" /><image v-if="shouldShowImage(item)" class="category-image" :src="item.imageUrl" mode="aspectFill" @error="markImageLoadFailed(item)" /></view>
              <text class="category-name">{{ item.name }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>
      <view v-else class="empty-category">
        <image v-if="mascots" class="empty-cat" :src="mascots.empty" mode="aspectFit" />
        <text>暂无可用{{ form.transactionType === 'EXPENSE' ? '支出' : '收入' }}分类</text>
      </view>
      <view v-if="categoryPages.length > 1" class="category-dots">
        <text v-for="(_, index) in categoryPages" :key="index" :class="{ 'active-dot': currentCategoryPage === index }" />
      </view>
    </view>

    <view v-if="keyboardHeight > 0" class="keyboard-mask" @touchmove.stop.prevent @click="dismissKeyboard" />
    <view class="entry-panel" :style="{ bottom: keyboardHeight ? keyboardHeight + 'px' : undefined }">
      <view class="entry-row">
        <input v-model.trim="form.note" class="note-input" placeholder="添加备注…" maxlength="255" :adjust-position="false" @confirm="dismissKeyboard" />
        <view class="amount-display">
          <text class="amount-currency">¥</text>
          <text class="amount-value">{{ displayAmount }}</text>
        </view>
      </view>
      <view v-show="keyboardHeight <= 0" class="keypad">
        <view v-for="key in keypadKeys" :key="key.label" :class="['key', key.className, { loading: key.action === 'submit' && submitting }]" @click="handleKey(key.action)">
          <image v-if="mascots && key.action === 'date'" class="key-paw" :src="mascots.milk" mode="aspectFit" />
          <view v-else-if="key.action === 'date'" class="key-icon-text"><u-icon name="calendar" size="14" /><text>今天</text></view>
          <text v-else>{{ keyLabel(key) }}</text>
        </view>
      </view>
    </view>

    <view v-if="calendarVisible" class="calendar-mask" @click.self="closeCalendar">
      <view class="calendar-panel">
        <view class="calendar-handle" />
        <view class="calendar-topbar"><view class="calendar-title-wrap"><image v-if="mascots" class="calendar-paw" :src="mascots.calendar" mode="aspectFit" /><text class="calendar-title">选择日期</text></view><text class="calendar-current">{{ form.occurredOn }}</text></view>
        <view class="calendar-nav"><text class="nav-button" @click="previousMonth">‹</text><text class="calendar-heading">{{ calendarYear }}年{{ calendarMonth + 1 }}月</text><text class="nav-button" @click="nextMonth">›</text></view>
        <view class="weekdays"><text v-for="weekday in weekdays" :key="weekday">{{ weekday }}</text></view>
        <view class="calendar-grid"><view v-for="(cell, index) in calendarCells" :key="`${cell.day || 'blank'}-${index}`" :class="['calendar-day', { 'calendar-empty': !cell.day, selected: isSelectedDate(cell.day), today: isToday(cell.day) }]" @click="cell.day && selectDate(cell.day)">{{ cell.day || '' }}</view></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatDate } from '../../utils/date'
import { showRequestError } from '../../utils/request'
import { themeStore } from '../../stores/theme'
import CategoryIcon from '../../category-icon/index.vue'

const CATEGORY_PAGE_SIZE = 12
// 猫咪主题：mascots 存在即进入猫咪模式，各位置使用专属猫咪素材
const mascots = computed(() => themeStore.currentTheme.mascots || null)
const headerCat = computed(() => mascots.value?.smile || themeStore.currentTheme.mascot || '')
const categories = ref([])
const currentCategoryPage = ref(0)
const failedImageKeys = ref(new Set())
const editingId = ref(null)
const submitting = ref(false)
const calendarVisible = ref(false)
const calendarYear = ref(new Date().getFullYear())
const calendarMonth = ref(new Date().getMonth())
const amountExpression = ref('')
const keyboardHeight = ref(0)
let keyboardHandler = null
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const form = reactive({ categoryId: null, categorySource: null, transactionType: 'EXPENSE', amount: '', occurredOn: formatDate(new Date()), note: '' })
const keypadKeys = [
  { label: '7', action: '7' }, { label: '8', action: '8' }, { label: '9', action: '9' }, { label: '今天', action: 'date', className: 'date-key' },
  { label: '4', action: '4' }, { label: '5', action: '5' }, { label: '6', action: '6' }, { label: '+', action: 'add', className: 'utility-key' },
  { label: '1', action: '1' }, { label: '2', action: '2' }, { label: '3', action: '3' }, { label: '−', action: 'subtract', className: 'utility-key' },
  { label: '.', action: '.' }, { label: '0', action: '0' }, { label: '⌫', action: 'delete', className: 'utility-key' }, { label: '完成', action: 'submit', className: 'submit-key' }
]
const filteredCategories = computed(() => categories.value
  .filter(item => item.transactionType === form.transactionType && (item.source !== 'SYSTEM' || item.status === 'ACTIVE')))
const categoryPages = computed(() => Array.from(
  { length: Math.ceil(filteredCategories.value.length / CATEGORY_PAGE_SIZE) },
  (_, index) => filteredCategories.value.slice(index * CATEGORY_PAGE_SIZE, (index * CATEGORY_PAGE_SIZE) + CATEGORY_PAGE_SIZE)
))
const displayAmount = computed(() => amountExpression.value || '0.00')
const calendarCells = computed(() => {
  const firstWeekday = (new Date(calendarYear.value, calendarMonth.value, 1).getDay() + 6) % 7
  const daysInMonth = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate()
  return [...Array.from({ length: firstWeekday }, () => ({})), ...Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1 }))]
})

function keyLabel(key) {
  if (key.action !== 'submit') return key.label
  if (submitting.value) return '保存中'
  if (mascots.value) return '保存喵'
  return editingId.value ? '保存修改' : '完成'
}

onLoad(load)
// uni.onKeyboardHeightChange 无返回值，必须保存 handler 引用并在 onUnload 中显式 off，否则重复进入页面会叠加监听
if (typeof uni.onKeyboardHeightChange === 'function') {
  keyboardHandler = ({ height }) => { keyboardHeight.value = height }
  uni.onKeyboardHeightChange(keyboardHandler)
}
// 键盘"收起高度=0"事件偶尔丢失，回到本页时强制归零，防止蒙层与输入面板悬浮错位
onShow(() => { keyboardHeight.value = 0 })
onUnload(() => {
  if (keyboardHandler && typeof uni.offKeyboardHeightChange === 'function') uni.offKeyboardHeightChange(keyboardHandler)
})
function goBack() { uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: '/pages/ledger/index' }) }) }
function dismissKeyboard() { if (typeof uni.hideKeyboard === 'function') uni.hideKeyboard() }
async function load(options = {}) {
  const id = Number(options.id)
  const validId = Number.isInteger(id) && id > 0
  try {
    const [categoryData, transaction] = await Promise.all([
      appApi.listCategories(),
      validId ? appApi.getTransaction(id) : Promise.resolve(null)
    ])
    categories.value = categoryData
    failedImageKeys.value = new Set()
    currentCategoryPage.value = 0
    if (!transaction) return
    editingId.value = id
    Object.assign(form, {
      categoryId: transaction.categorySource === 'SYSTEM' ? transaction.systemCategoryId : transaction.categoryId,
      categorySource: transaction.categorySource,
      transactionType: transaction.transactionType,
      occurredOn: transaction.occurredOn,
      note: transaction.note || ''
    })
    amountExpression.value = Number(transaction.amount).toFixed(2)
  } catch (error) { showRequestError(error) }
}
function selectType(type) {
  form.transactionType = type
  form.categoryId = null
  form.categorySource = null
  currentCategoryPage.value = 0
}
function onCategoryPageChange(event) { currentCategoryPage.value = event.detail.current }
function selectCategory(item) { form.categoryId = item.id; form.categorySource = item.source }
function isSelectedCategory(item) { return item.id === form.categoryId && item.source === form.categorySource }
function categoryKey(item) { return `${item.source}-${item.id}` }
function shouldShowImage(item) { return Boolean(item.imageUrl) && !failedImageKeys.value.has(categoryKey(item)) }
function markImageLoadFailed(item) { failedImageKeys.value = new Set([...failedImageKeys.value, categoryKey(item)]) }

function evaluateExpression(expression) {
  if (!/^\d+(?:\.\d{1,2})?(?:[+-]\d+(?:\.\d{1,2})?)*$/.test(expression)) return null
  const terms = expression.match(/[+-]?\d+(?:\.\d{1,2})?/g)
  if (!terms) return null
  const amount = terms.reduce((total, term) => total + Number(term), 0)
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : null
}
function appendNumber(value) {
  const currentPart = amountExpression.value.split(/[+-]/).pop()
  if (value === '.' && currentPart.includes('.')) return
  if (currentPart.includes('.') && currentPart.split('.')[1].length >= 2) return
  amountExpression.value = value === '.' && !currentPart ? `${amountExpression.value}0.` : `${amountExpression.value}${value}`
}
function appendOperator(operator) {
  if (!amountExpression.value) return
  if (/[+-]$/.test(amountExpression.value)) {
    amountExpression.value = `${amountExpression.value.slice(0, -1)}${operator}`
    return
  }
  const calculatedAmount = evaluateExpression(amountExpression.value)
  const baseAmount = calculatedAmount === null ? amountExpression.value : (Number.isInteger(calculatedAmount) ? String(calculatedAmount) : calculatedAmount.toFixed(2))
  amountExpression.value = `${baseAmount}${operator}`
}
function handleKey(action) {
  if (action === 'date') return openCalendar()
  if (action === 'delete') { amountExpression.value = amountExpression.value.slice(0, -1); return }
  if (action === 'add') return appendOperator('+')
  if (action === 'subtract') return appendOperator('-')
  if (action === 'submit') return submit()
  appendNumber(action)
}
function dateParts(value) { return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) - 1, day: Number(value.slice(8, 10)) } }
function openCalendar() { const date = dateParts(form.occurredOn); calendarYear.value = date.year; calendarMonth.value = date.month; calendarVisible.value = true }
function closeCalendar() { calendarVisible.value = false }
function previousMonth() { const date = new Date(calendarYear.value, calendarMonth.value - 1, 1); calendarYear.value = date.getFullYear(); calendarMonth.value = date.getMonth() }
function nextMonth() { const date = new Date(calendarYear.value, calendarMonth.value + 1, 1); calendarYear.value = date.getFullYear(); calendarMonth.value = date.getMonth() }
function selectDate(day) { form.occurredOn = formatDate(new Date(calendarYear.value, calendarMonth.value, day)); calendarVisible.value = false }
function isSelectedDate(day) { return Boolean(day) && form.occurredOn === formatDate(new Date(calendarYear.value, calendarMonth.value, day)) }
function isToday(day) { return Boolean(day) && formatDate(new Date()) === formatDate(new Date(calendarYear.value, calendarMonth.value, day)) }
async function submit() {
  if (!form.categoryId || !form.categorySource) return uni.showToast({ title: '请选择分类', icon: 'none' })
  if (!form.occurredOn) return uni.showToast({ title: '请选择日期', icon: 'none' })
  const calculatedAmount = evaluateExpression(amountExpression.value)
  if (calculatedAmount === null || calculatedAmount <= 0) return uni.showToast({ title: '请输入正确金额', icon: 'none' })
  form.amount = calculatedAmount.toFixed(2)
  submitting.value = true
  try {
    const payload = { ...form, amount: form.amount, note: form.note || null }
    if (editingId.value) await appApi.updateTransaction(editingId.value, payload)
    else await appApi.createTransaction(payload)
    uni.$emit('ledger:invalidate')
    uni.showToast({ title: editingId.value ? '已更新' : '已保存', icon: 'success' })
    // 编辑完成后自动返回；新建保存后留在本页并清空金额备注，支持连续记账，由用户手动返回
    if (editingId.value) setTimeout(() => uni.navigateBack(), 450)
    else { amountExpression.value = ''; form.note = '' }
  } catch (error) { showRequestError(error) } finally { submitting.value = false }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; min-height: 100vh; overflow: hidden; padding-top: calc(max(var(--status-bar-height, 0px), env(safe-area-inset-top, 0px)) + 16rpx); padding-bottom: calc(600rpx + env(safe-area-inset-bottom)); background: var(--theme-page-bg); box-sizing: border-box; }

/* 顶部：返回 + 标题 + 主题形象 */
.book-header { display: flex; align-items: center; margin: 0 24rpx 20rpx; padding: 24rpx 28rpx; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-2); border: 1rpx solid var(--theme-border); }
.back-button { position: relative; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; flex: 0 0 64rpx; border-radius: 20rpx; background: var(--theme-primary-soft); transition: transform .15s ease, opacity .15s ease; }
.back-button::before { width: 16rpx; height: 16rpx; margin-left: 6rpx; border-bottom: 4rpx solid var(--theme-primary); border-left: 4rpx solid var(--theme-primary); content: ''; transform: rotate(45deg); }
.back-button:active { transform: scale(.94); opacity: .85; }
.book-title { display: flex; flex: 1; flex-direction: column; align-items: flex-end; color: var(--theme-text); font-size: var(--font-md); font-weight: 700; }
.book-subtitle { margin-top: 5rpx; color: var(--theme-text-muted); font-size: var(--font-caption); font-weight: 400; }
.book-icon { display: flex; align-items: center; justify-content: center; width: 48rpx; height: 48rpx; margin-left: 15rpx; color: var(--theme-primary); }
.book-icon-image { width: 64rpx; height: 64rpx; margin-left: 12rpx; }

/* 支出/收入：胶囊分段切换，白色滑块跟随 */
.type-switch { position: relative; display: flex; margin: 0 24rpx 24rpx; padding: 6rpx; border-radius: 999rpx; background: var(--theme-page-bg); border: 1rpx solid var(--theme-border); }
.type-indicator { position: absolute; top: 6rpx; bottom: 6rpx; left: 6rpx; width: calc(50% - 6rpx); border-radius: 999rpx; background: var(--theme-surface); box-shadow: var(--elev-1); transition: transform .2s ease; }
.type-indicator.indicator-right { transform: translateX(100%); }
.type { position: relative; z-index: 1; flex: 1; padding: 18rpx 0; color: var(--theme-text-secondary); font-size: var(--font-md); text-align: center; transition: color .2s ease; }
.type.active { color: var(--theme-primary); font-weight: 600; }
.type:active { opacity: .7; }

/* 分类九宫格：圆角方形图标 */
.category-section { flex: 1; min-height: 0; margin: 0 24rpx 20rpx; padding: 28rpx; overflow: hidden; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-2); border: 1rpx solid var(--theme-border); }
.category-swiper { height: 500rpx; }
.category-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, auto); row-gap: 28rpx; column-gap: 16rpx; padding: 12rpx 6rpx; box-sizing: border-box; }
.category-item { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.category-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 94rpx; height: 94rpx; overflow: hidden; border: 2rpx solid var(--theme-border); border-radius: 26rpx; background: var(--theme-surface); box-sizing: border-box; transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.category-image { position: absolute; inset: 0; width: 100%; height: 100%; }
.category-name { width: 100%; margin-top: 8rpx; overflow: hidden; color: var(--theme-text-secondary); font-size: var(--font-caption); text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.category-item.selected .category-icon { border: 4rpx solid var(--theme-primary); box-shadow: 0 6rpx 14rpx var(--theme-primary-shadow); transform: scale(1.04); }
.category-item.selected .category-name { color: var(--theme-primary); font-weight: 600; }
.category-item:active .category-icon { transform: scale(.94); }
.empty-category { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 120rpx; color: var(--theme-text-muted); font-size: var(--font-body); text-align: center; }
.empty-cat { width: 140rpx; height: 140rpx; margin-bottom: 10rpx; }
.keyboard-mask { position: fixed; z-index: 19; top: 0; right: 0; bottom: 0; left: 0; }
.category-dots { display: flex; justify-content: center; gap: 13rpx; margin: 28rpx 0 4rpx; }
.category-dots text { display: block; width: 11rpx; height: 11rpx; border-radius: 50%; background: var(--theme-border); }
.category-dots .active-dot { width: 14rpx; height: 14rpx; margin-top: -2rpx; background: var(--theme-primary); }

/* 底部输入面板：备注 + 金额同行，下接键盘 */
.entry-panel { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 24rpx 24rpx calc(28rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid var(--theme-border); border-radius: 32rpx 32rpx 0 0; background: var(--theme-surface); box-shadow: var(--elev-3); }
.entry-row { display: flex; align-items: center; gap: 12rpx; }
.note-input { flex: 1; min-width: 0; height: 76rpx; padding: 0 24rpx; border: 0; border-radius: var(--theme-radius-control); color: var(--theme-text-strong); background: var(--theme-page-bg); font-size: var(--font-body); box-sizing: border-box; }
.amount-display { display: flex; align-items: baseline; justify-content: flex-end; flex-shrink: 0; gap: 6rpx; max-width: 400rpx; padding: 0 8rpx; color: var(--theme-text); }
.amount-currency { color: var(--theme-text-muted); font-size: 30rpx; font-weight: 500; }
.amount-value { overflow: hidden; font-size: 44rpx; font-weight: 700; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.keypad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; margin-top: 20rpx; }
.key { display: flex; align-items: center; justify-content: center; height: 96rpx; border-radius: 20rpx; color: var(--theme-text-strong); background: var(--theme-page-bg); font-size: 34rpx; font-weight: 600; transition: transform .12s ease, background-color .12s ease, opacity .12s ease; }
.key:active { transform: scale(.95); background: var(--theme-primary-soft); }
.key.loading { opacity: .6; pointer-events: none; }
.date-key, .utility-key { color: var(--theme-primary); background: var(--theme-primary-soft); }
.date-key { font-size: var(--font-caption); }
.utility-key { font-size: 40rpx; font-weight: 500; }
.submit-key { color: var(--theme-on-primary); background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); font-size: var(--font-md); font-weight: 600; box-shadow: 0 8rpx 20rpx var(--theme-primary-shadow); }
.key-icon-text { display: flex; align-items: center; gap: 8rpx; }
.key-paw { width: 38rpx; height: 38rpx; opacity: .9; }

/* 日期弹层 */
.calendar-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .5); overscroll-behavior: contain; }
.calendar-panel { width: 100%; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border-radius: 36rpx 36rpx 0 0; background: var(--theme-surface); box-shadow: var(--elev-3); box-sizing: border-box; }
.calendar-handle { width: 72rpx; height: 8rpx; margin: 0 auto 24rpx; border-radius: 999rpx; background: var(--theme-border); }
.calendar-title-wrap { display: flex; align-items: center; }
.calendar-paw { width: 40rpx; height: 40rpx; margin-right: 12rpx; }
.calendar-topbar { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 24rpx; }
.calendar-title { color: var(--theme-text); font-size: var(--font-title); font-weight: 700; }
.calendar-current { color: var(--theme-text-muted); font-size: var(--font-caption); }
.calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26rpx; }
.nav-button { width: 70rpx; color: var(--theme-text); font-size: 64rpx; line-height: 1; text-align: center; }
.calendar-heading { color: var(--theme-text); font-size: 32rpx; font-weight: 700; }
.weekdays, .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.weekdays { margin-bottom: 12rpx; }
.weekdays text { color: var(--theme-text-muted); font-size: var(--font-caption); text-align: center; }
.calendar-grid { grid-auto-rows: 86rpx; }
.calendar-day { display: flex; align-items: center; justify-content: center; height: 74rpx; min-height: 0; margin: 5rpx; border-radius: 50%; color: var(--theme-text-strong); font-size: var(--font-body); }
.calendar-day.calendar-empty { pointer-events: none; }
.calendar-day.today { color: var(--theme-primary); font-weight: 700; }
.calendar-day.selected { color: var(--theme-on-primary); background: var(--theme-primary); box-shadow: 0 6rpx 14rpx var(--theme-primary-shadow); }
.calendar-day.selected.today { color: var(--theme-on-primary); }
.nav-button:active, .calendar-day:active { opacity: .7; }
</style>
