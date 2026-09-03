<template>
  <view class="page" :style="themeStore.cssVariables">
    <view class="book-header">
      <view class="back-button" @click="goBack" />
      <view class="book-title"><text>{{ editingId ? '编辑流水' : '默认账本' }}</text><text class="book-subtitle">{{ editingId ? '修改金额、备注或分类' : '记录每一笔收支' }}</text></view>
      <view class="book-icon">📋</view>
    </view>

    <view class="type-switch">
      <view :class="['type', { 'active-expense': form.transactionType === 'EXPENSE' }]" @click="selectType('EXPENSE')"><text>支出</text></view>
      <view :class="['type', { 'active-income': form.transactionType === 'INCOME' }]" @click="selectType('INCOME')"><text>收入</text></view>
    </view>

    <view class="category-section">
      <swiper v-if="categoryPages.length" class="category-swiper" :current="currentCategoryPage" @change="onCategoryPageChange">
        <swiper-item v-for="(page, pageIndex) in categoryPages" :key="pageIndex">
          <view class="category-grid">
            <view v-for="item in page" :key="`${item.source}-${item.id}`" :class="['category-item', { selected: isSelectedCategory(item) }]" @click="selectCategory(item)">
              <view class="category-icon"><text class="icon-emoji">{{ categoryIcon(item.name, form.transactionType) }}</text><image v-if="item.imageUrl" class="category-image" :src="item.imageUrl" mode="aspectFill" /></view>
              <text class="category-name">{{ item.name }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>
      <view v-else class="empty-category">暂无可用{{ form.transactionType === 'EXPENSE' ? '支出' : '收入' }}分类</view>
      <view v-if="categoryPages.length > 1" class="category-dots">
        <text v-for="(_, index) in categoryPages" :key="index" :class="{ 'active-dot': currentCategoryPage === index }" />
      </view>
    </view>

    <view v-if="noteFocused && keyboardHeight > 0" class="keyboard-mask" @touchmove.stop.prevent @click="dismissKeyboard" />
    <view class="entry-panel" :style="{ bottom: keyboardHeight && noteFocused ? keyboardHeight + 'px' : undefined }">
      <view class="entry-row">
        <input v-model.trim="form.note" class="note-input" placeholder="点击输入备注..." maxlength="255" :adjust-position="false" @focus="onNoteFocus" @blur="onNoteBlur" @confirm="onNoteBlur" />
        <view class="amount-display"><text class="currency">¥</text><text>{{ displayAmount }}</text></view>
      </view>
      <view v-show="!noteFocused" class="keypad">
        <view v-for="key in keypadKeys" :key="key.label" :class="['key', key.className, { loading: key.action === 'submit' && submitting }]" @click="handleKey(key.action)">{{ key.action === 'submit' && submitting ? '保存中' : key.action === 'submit' && editingId ? '保存修改' : key.label }}</view>
      </view>
    </view>

    <view v-if="calendarVisible" class="calendar-mask" @click.self="closeCalendar">
      <view class="calendar-panel">
        <view class="calendar-handle" />
        <view class="calendar-topbar"><text class="calendar-title">选择日期</text><text class="calendar-current">{{ form.occurredOn }}</text></view>
        <view class="calendar-nav"><text class="nav-button" @click="previousMonth">‹</text><text class="calendar-heading">{{ calendarYear }}年{{ calendarMonth + 1 }}月</text><text class="nav-button" @click="nextMonth">›</text></view>
        <view class="weekdays"><text v-for="weekday in weekdays" :key="weekday">{{ weekday }}</text></view>
        <view class="calendar-grid"><view v-for="(cell, index) in calendarCells" :key="`${cell.day || 'blank'}-${index}`" :class="['calendar-day', { 'calendar-empty': !cell.day, selected: isSelectedDate(cell.day), today: isToday(cell.day) }]" @click="cell.day && selectDate(cell.day)">{{ cell.day || '' }}</view></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatDate } from '../../utils/date'
import { showRequestError } from '../../utils/request'
import { themeStore } from '../../stores/theme'
import { categoryIcon } from '../../utils/category-icon'

const CATEGORY_PAGE_SIZE = 12
const categories = ref([])
const currentCategoryPage = ref(0)
const failedImageKeys = ref(new Set())
const editingId = ref(null)
const submitting = ref(false)
const calendarVisible = ref(false)
const calendarYear = ref(new Date().getFullYear())
const calendarMonth = ref(new Date().getMonth())
const amountExpression = ref('')
const noteFocused = ref(false)
const keyboardHeight = ref(0)
let keyboardListener = null
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const form = reactive({ categoryId: null, categorySource: null, transactionType: 'EXPENSE', amount: '', occurredOn: formatDate(new Date()), note: '' })
const keypadKeys = [
  { label: '7', action: '7' }, { label: '8', action: '8' }, { label: '9', action: '9' }, { label: '🗓 今天', action: 'date', className: 'date-key' },
  { label: '4', action: '4' }, { label: '5', action: '5' }, { label: '6', action: '6' }, { label: '+', action: 'add', className: 'utility-key' },
  { label: '1', action: '1' }, { label: '2', action: '2' }, { label: '3', action: '3' }, { label: '−', action: 'subtract', className: 'utility-key' },
  { label: '.', action: '.' }, { label: '0', action: '0' }, { label: '⌫', action: 'delete', className: 'utility-key' }, { label: '完成', action: 'submit', className: 'submit-key' }
]
const filteredCategories = computed(() => categories.value
  .filter(item => item.transactionType === form.transactionType && (item.source !== 'SYSTEM' || item.status === 'ACTIVE'))
  .map(item => ({ ...item, label: `${item.name}${item.source === 'SYSTEM' ? '（系统）' : '（自定义）'}` })))
const categoryPages = computed(() => Array.from(
  { length: Math.ceil(filteredCategories.value.length / CATEGORY_PAGE_SIZE) },
  (_, index) => filteredCategories.value.slice(index * CATEGORY_PAGE_SIZE, (index + 1) * CATEGORY_PAGE_SIZE)
))
const displayAmount = computed(() => amountExpression.value || '0.00')
const calendarCells = computed(() => {
  const firstWeekday = (new Date(calendarYear.value, calendarMonth.value, 1).getDay() + 6) % 7
  const daysInMonth = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate()
  return [...Array.from({ length: firstWeekday }, () => ({})), ...Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1 }))]
})

onLoad(load)
if (typeof uni.onKeyboardHeightChange === 'function') keyboardListener = uni.onKeyboardHeightChange(({ height }) => { keyboardHeight.value = height })
onUnload(() => { if (keyboardListener?.off) keyboardListener.off() })
function goBack() { uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: '/pages/ledger/index' }) }) }
function onNoteFocus() { noteFocused.value = true }
function onNoteBlur() { noteFocused.value = false }
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
.page { display: flex; flex-direction: column; height: 100vh; min-height: 100vh; overflow: hidden; padding-top: calc(max(var(--status-bar-height, 0px), env(safe-area-inset-top, 0px)) + 16rpx); padding-bottom: calc(600rpx + env(safe-area-inset-bottom)); background: #f5f7fb; box-sizing: border-box; }
.book-header { display: flex; align-items: center; margin: 0 24rpx 20rpx; padding: 24rpx 28rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }
.back-button { position: relative; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; flex: 0 0 64rpx; border-radius: 16rpx; background: #eff6ff; }
.back-button::before { width: 16rpx; height: 16rpx; margin-left: 6rpx; border-bottom: 4rpx solid #1677ff; border-left: 4rpx solid #1677ff; content: ''; transform: rotate(45deg); }
.book-title { display: flex; flex: 1; flex-direction: column; align-items: flex-end; color: #1d2939; font-size: 29rpx; font-weight: 700; }
.book-subtitle { margin-top: 5rpx; color: #98a2b3; font-size: 20rpx; font-weight: 400; }
.book-icon { display: flex; align-items: center; justify-content: center; width: 48rpx; height: 48rpx; margin-left: 15rpx; font-size: 38rpx; line-height: 1; }
.type-switch { display: flex; gap: 0; margin: 0 24rpx 24rpx; overflow: hidden; border-radius: 20rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }
.type { position: relative; flex: 1; padding: 22rpx 0; color: #667085; font-size: 30rpx; text-align: center; }
.type.active-expense, .type.active-income { color: #1677ff; background: #eff6ff; }
.type.active-expense::after, .type.active-income::after { position: absolute; right: 45%; bottom: 8rpx; left: 45%; height: 5rpx; border-radius: 8rpx; background: #1677ff; content: ''; }
.category-section { flex: 1; min-height: 0; margin: 0 24rpx 20rpx; padding: 28rpx; overflow: hidden; border-radius: 24rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }
.category-swiper { height: 500rpx; }
.category-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, auto); row-gap: 28rpx; column-gap: 16rpx; padding: 12rpx 6rpx; box-sizing: border-box; }
.category-item { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.category-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 94rpx; height: 94rpx; overflow: hidden; border: 2rpx solid #e4e7ec; border-radius: 50%; background: #f8fafc; box-sizing: border-box; transition: transform .16s ease; }
.category-icon .icon-emoji { font-size: 48rpx; line-height: 1; filter: saturate(.85); }
.category-image { position: absolute; inset: 0; width: 100%; height: 100%; }
.category-name { width: 100%; margin-top: 8rpx; overflow: hidden; color: #475467; font-size: 24rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.category-item.selected .category-icon { border: 4rpx solid #1677ff; background: #eff6ff; box-shadow: 0 6rpx 14rpx rgba(22, 119, 255, .16); transform: scale(1.04); }
.category-item.selected .category-name { color: #1677ff; }
.empty-category { padding-top: 134rpx; color: #98a2b3; text-align: center; }
.keyboard-mask { position: fixed; z-index: 19; top: 0; right: 0; bottom: 0; left: 0; }
.category-dots { display: flex; justify-content: center; gap: 13rpx; margin: 28rpx 0 4rpx; }
.category-dots text { display: block; width: 11rpx; height: 11rpx; border-radius: 50%; background: #d0d5dd; }
.category-dots .active-dot { width: 14rpx; height: 14rpx; margin-top: -2rpx; background: #1677ff; }
.entry-panel { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e4e7ec; background: #fff; box-shadow: 0 -8rpx 24rpx rgba(36, 58, 99, .06); }
.entry-row { display: flex; align-items: center; height: 82rpx; margin-bottom: 16rpx; }
.note-input { flex: 1; height: 82rpx; min-width: 0; padding: 0 16rpx; border: 0; border-radius: 16rpx 0 0 16rpx; color: #344054; background: #f7f8fa; font-size: 27rpx; box-sizing: border-box; }
.amount-display { display: flex; align-items: center; justify-content: flex-end; min-width: 190rpx; height: 82rpx; padding: 0 16rpx 0 2rpx; border-radius: 0 16rpx 16rpx 0; color: #1677ff; background: #f7f8fa; font-size: 40rpx; font-weight: 600; box-sizing: border-box; }
.currency { margin-right: 5rpx; font-size: 29rpx; font-weight: 400; }
.keypad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; }
.key { display: flex; align-items: center; justify-content: center; height: 104rpx; border: 1rpx solid #e4e7ec; border-radius: 16rpx; color: #344054; background: #f8fafc; font-size: 36rpx; font-weight: 700; }
.key:active { background: #eff6ff; }.key.loading { opacity: .7; pointer-events: none; }.date-key, .utility-key { color: #1677ff; background: #eff6ff; }.date-key { font-size: 24rpx; }.utility-key { font-size: 40rpx; }.submit-key { color: #fff; background: #1677ff; font-size: 28rpx; }
.calendar-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(16, 24, 40, .45); }
.calendar-panel { width: 100%; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border-radius: 32rpx 32rpx 0 0; background: #fff; box-sizing: border-box; }
.calendar-handle { width: 72rpx; height: 8rpx; margin: 0 auto 23rpx; border-radius: 10rpx; background: #e4e7ec; }.calendar-topbar { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 24rpx; }.calendar-title, .calendar-heading, .nav-button { color: #1d2939; }.calendar-title { font-size: 34rpx; font-weight: 700; }.calendar-current, .weekdays text { color: #98a2b3; }.calendar-current { font-size: 24rpx; }.calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26rpx; }.nav-button { width: 70rpx; font-size: 68rpx; line-height: 1; text-align: center; }.calendar-heading { font-size: 32rpx; font-weight: 700; }.weekdays, .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }.calendar-grid { grid-auto-rows: 86rpx; }.weekdays { margin-bottom: 12rpx; }.weekdays text { font-size: 24rpx; text-align: center; }.calendar-day { display: flex; align-items: center; justify-content: center; height: 74rpx; min-height: 0; margin: 5rpx; border-radius: 50%; color: #344054; font-size: 28rpx; }.calendar-day.calendar-empty { pointer-events: none; }.calendar-day.today { color: #1677ff; font-weight: 700; }.calendar-day.selected { color: #fff; background: #1677ff; box-shadow: 0 6rpx 14rpx rgba(22, 119, 255, .22); }.calendar-day.selected.today { color: #fff; }

/* 主题覆盖：记账表单的容器、分类、键盘与日历统一跟随当前主题。 */
.page { background: var(--theme-page-bg) !important; }
.book-header, .type-switch, .category-section, .entry-panel, .calendar-panel { background: var(--theme-surface) !important; }
.book-title, .calendar-title, .calendar-heading, .nav-button { color: var(--theme-text) !important; }
.book-subtitle, .empty-category, .calendar-current, .weekdays text { color: var(--theme-text-muted) !important; }
.back-button { background: var(--theme-primary-soft) !important; }
.back-button::before { border-color: var(--theme-primary) !important; }
.type { color: var(--theme-text-secondary) !important; }
.type.active-expense, .type.active-income { color: var(--theme-primary) !important; background: var(--theme-primary-soft) !important; }
.type.active-expense::after, .type.active-income::after { background: var(--theme-primary) !important; }
.category-icon { border-color: var(--theme-border) !important; background: var(--theme-page-bg) !important; }
.category-name { color: var(--theme-text-secondary) !important; }
.category-item.selected .category-icon { border-color: var(--theme-primary) !important; background: var(--theme-primary-soft) !important; box-shadow: 0 6rpx 14rpx var(--theme-primary-shadow) !important; }
.category-item.selected .category-name { color: var(--theme-primary) !important; }
.category-dots text { background: var(--theme-border) !important; }
.category-dots .active-dot { background: var(--theme-primary) !important; }
.entry-panel { border-color: var(--theme-border) !important; }
.note-input, .amount-display { background: var(--theme-page-bg) !important; }
.note-input, .key, .calendar-day { color: var(--theme-text-strong) !important; }
.note-input::placeholder { color: var(--theme-text-muted) !important; }
.amount-display, .date-key, .utility-key { color: var(--theme-primary) !important; }
.key { border-color: var(--theme-border) !important; background: var(--theme-surface) !important; }
.key:active, .date-key, .utility-key { background: var(--theme-primary-soft) !important; }
.submit-key { color: #fff !important; background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-end)) !important; }
.calendar-handle { background: var(--theme-border) !important; }
.calendar-day.today { color: var(--theme-primary) !important; }
.calendar-day.selected { color: #fff !important; background: var(--theme-primary) !important; box-shadow: 0 6rpx 14rpx var(--theme-primary-shadow) !important; }
</style>
