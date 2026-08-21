<template>
  <view class="page">
    <view class="book-header">
      <view class="back-button" @click="goBack">‹</view>
      <view class="book-title"><text>默认账本</text><text class="book-subtitle">记录每一笔收支</text></view>
      <view class="book-icon">📋</view>
    </view>

    <view class="type-switch">
      <view :class="['type', { 'active-expense': form.transactionType === 'EXPENSE' }]" @click="selectType('EXPENSE')"><text>支出</text></view>
      <view :class="['type', { 'active-income': form.transactionType === 'INCOME' }]" @click="selectType('INCOME')"><text>收入</text></view>
    </view>

    <view class="category-section">
      <view v-if="filteredCategories.length" class="category-grid">
        <view v-for="item in filteredCategories" :key="`${item.source}-${item.id}`" :class="['category-item', { selected: isSelectedCategory(item) }]" @click="selectCategory(item)">
          <view class="category-icon"><text>{{ categoryIcon(item.name) }}</text></view>
          <text class="category-name">{{ item.name }}</text>
        </view>
      </view>
      <view v-else class="empty-category">暂无可用{{ form.transactionType === 'EXPENSE' ? '支出' : '收入' }}分类</view>
      <view class="category-dots"><text class="active-dot" /><text /><text /><text /></view>
    </view>

    <view class="entry-panel">
      <view class="entry-row">
        <view class="note-icon">👛</view>
        <input v-model.trim="form.note" class="note-input" placeholder="点击输入备注..." maxlength="255" />
        <view class="amount-display"><text class="currency">¥</text><text>{{ displayAmount }}</text></view>
      </view>
      <view class="keypad">
        <view v-for="key in keypadKeys" :key="key.label" :class="['key', key.className, { loading: key.action === 'submit' && submitting }]" @click="handleKey(key.action)">{{ key.action === 'submit' && submitting ? '保存中' : key.label }}</view>
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
import { onLoad } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatDate } from '../../utils/date'
import { showRequestError } from '../../utils/request'

const categories = ref([])
const submitting = ref(false)
const calendarVisible = ref(false)
const calendarYear = ref(new Date().getFullYear())
const calendarMonth = ref(new Date().getMonth())
const amountExpression = ref('')
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const form = reactive({ categoryId: null, categorySource: null, transactionType: 'EXPENSE', amount: '', occurredOn: formatDate(new Date()), note: '' })
const keypadKeys = [
  { label: '7', action: '7' }, { label: '8', action: '8' }, { label: '9', action: '9' }, { label: '🗓 今天', action: 'date', className: 'date-key' },
  { label: '4', action: '4' }, { label: '5', action: '5' }, { label: '6', action: '6' }, { label: '+', action: 'add', className: 'utility-key' },
  { label: '1', action: '1' }, { label: '2', action: '2' }, { label: '3', action: '3' }, { label: '−', action: 'subtract', className: 'utility-key' },
  { label: '.', action: '.' }, { label: '0', action: '0' }, { label: '⌫', action: 'delete', className: 'utility-key' }, { label: '完成', action: 'submit', className: 'submit-key' }
]
const filteredCategories = computed(() => categories.value.filter(item => item.transactionType === form.transactionType && (item.source !== 'SYSTEM' || item.status === 'ACTIVE')).map(item => ({ ...item, label: `${item.name}${item.source === 'SYSTEM' ? '（系统）' : '（自定义）'}` })))
const displayAmount = computed(() => amountExpression.value || '0.00')
const calendarCells = computed(() => {
  const firstWeekday = (new Date(calendarYear.value, calendarMonth.value, 1).getDay() + 6) % 7
  const daysInMonth = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate()
  return [...Array.from({ length: firstWeekday }, () => ({})), ...Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1 }))]
})

onLoad(load)
function goBack() { uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: '/pages/ledger/index' }) }) }
async function load() { try { categories.value = await appApi.listCategories() } catch (error) { showRequestError(error) } }
function selectType(type) { form.transactionType = type; form.categoryId = null; form.categorySource = null }
function selectCategory(item) { form.categoryId = item.id; form.categorySource = item.source }
function isSelectedCategory(item) { return item.id === form.categoryId && item.source === form.categorySource }
function categoryIcon(name) {
  const icons = { 餐饮: '🍱', 购物: '🛍️', 日用: '🧻', 交通: '🚌', 蔬菜: '🥬', 水果: '🍎', 零食: '🧁', 运动: '🛼', 娱乐: '🎮', 通讯: '📞', 服饰: '👕', 美容: '🪞', 工资: '💰', 奖金: '🎁', 理财: '📈', 退款: '↩️' }
  return icons[name] || (form.transactionType === 'EXPENSE' ? '◌' : '＋')
}
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
  try { await appApi.createTransaction({ ...form, amount: form.amount, note: form.note || null }); uni.showToast({ title: '已保存', icon: 'success' }); setTimeout(() => uni.navigateBack(), 450) } catch (error) { showRequestError(error) } finally { submitting.value = false }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; min-height: 100vh; overflow: hidden; padding: calc(16rpx + env(safe-area-inset-top)) 0 0; background-color: #fffef8; background-image: radial-gradient(circle at 10% 12%, rgba(255, 224, 96, .16) 0 11rpx, transparent 12rpx), radial-gradient(circle at 84% 30%, rgba(255, 224, 96, .14) 0 15rpx, transparent 16rpx), radial-gradient(circle at 20% 57%, rgba(255, 224, 96, .12) 0 9rpx, transparent 10rpx); box-sizing: border-box; }.book-header { display: flex; align-items: center; padding: 14rpx 48rpx 10rpx; }.book-illustration { display: flex; align-items: center; width: 82rpx; height: 64rpx; color: #394a37; font-size: 57rpx; line-height: 1; }.book-title { display: flex; flex: 1; flex-direction: column; align-items: flex-end; color: #252b28; font-size: 29rpx; font-weight: 700; }.book-subtitle { margin-top: 5rpx; color: #92978d; font-size: 20rpx; font-weight: 400; }.book-icon { display: flex; align-items: center; justify-content: center; width: 48rpx; height: 48rpx; margin-left: 15rpx; font-size: 43rpx; line-height: 1; }.type-switch { display: flex; justify-content: center; gap: 58rpx; margin: 17rpx 0 45rpx; }.type { position: relative; padding: 12rpx 8rpx; color: #9a9a95; font-size: 39rpx; font-weight: 600; }.type.active-expense { color: #2d3935; }.type.active-expense::after { position: absolute; right: 1rpx; bottom: 0; left: 1rpx; height: 7rpx; border-radius: 50%; background: #f47c8d; box-shadow: 14rpx 8rpx 0 -1rpx #f47c8d, -7rpx 10rpx 0 -2rpx #f47c8d; content: ''; transform: rotate(4deg); }.type.active-income { color: #2f774b; }.type.active-income::after { position: absolute; right: 7rpx; bottom: 1rpx; left: 7rpx; height: 5rpx; border-radius: 8rpx; background: #5fbe7e; content: ''; }.category-section { flex: 1; min-height: 0; overflow-y: auto; padding: 0 48rpx; }.category-grid { display: grid; grid-template-columns: repeat(4, 1fr); row-gap: 30rpx; column-gap: 19rpx; }.category-item { display: flex; flex-direction: column; align-items: center; min-width: 0; }.category-icon { display: flex; align-items: center; justify-content: center; width: 102rpx; height: 102rpx; border: 4rpx solid #303938; border-radius: 50%; background: #fffefa; box-sizing: border-box; transition: transform .16s ease; }.category-icon text { font-size: 54rpx; line-height: 1; filter: saturate(.85); }.category-name { width: 100%; margin-top: 8rpx; overflow: hidden; color: #3b4643; font-size: 26rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }.category-item.selected .category-icon { border-color: #ef7890; border-width: 6rpx; background: #fff7f7; transform: scale(1.05); }.category-item.selected .category-name { color: #d85d76; font-weight: 700; }.empty-category { padding-top: 134rpx; color: #a2a69e; text-align: center; }.category-dots { display: flex; justify-content: center; gap: 13rpx; margin: 31rpx 0 25rpx; }.category-dots text { display: block; width: 11rpx; height: 11rpx; border-radius: 50%; background: #a8aea5; }.category-dots .active-dot { width: 14rpx; height: 14rpx; margin-top: -2rpx; background: #33433e; }.entry-panel { flex: 0 0 auto; margin-top: auto; padding: 25rpx 28rpx calc(25rpx + env(safe-area-inset-bottom)); border-top: 5rpx solid #2e3532; background: #ffd75b; box-shadow: 0 -7rpx 0 rgba(255, 215, 91, .35); }.entry-row { display: flex; align-items: center; height: 96rpx; margin-bottom: 18rpx; }.note-icon { display: flex; align-items: center; justify-content: center; width: 82rpx; height: 82rpx; margin-right: 18rpx; border: 4rpx solid #303938; border-radius: 50%; color: #3d4a45; background: #fffef8; font-size: 45rpx; }.note-input { flex: 1; height: 88rpx; min-width: 0; padding: 0 16rpx; border: 4rpx solid #303938; border-right: 0; border-radius: 20rpx 0 0 20rpx; color: #404a46; background: #fffefb; font-size: 27rpx; box-sizing: border-box; }.amount-display { display: flex; align-items: center; justify-content: flex-end; min-width: 174rpx; height: 88rpx; padding: 0 16rpx 0 2rpx; border: 4rpx solid #303938; border-left: 0; border-radius: 0 20rpx 20rpx 0; color: #26312e; background: #fffefb; font-size: 43rpx; font-weight: 600; box-sizing: border-box; }.currency { margin-right: 5rpx; font-size: 31rpx; font-weight: 400; }.keypad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14rpx; }.key { display: flex; align-items: center; justify-content: center; height: 85rpx; border: 4rpx solid #303938; border-radius: 17rpx; color: #303a37; background: #fffefb; box-shadow: 0 6rpx 0 rgba(48, 57, 56, .28); font-size: 38rpx; font-weight: 700; }.key:active { box-shadow: 0 2rpx 0 rgba(48, 57, 56, .22); transform: translateY(4rpx); }.key.loading { opacity: .7; pointer-events: none; }.date-key { color: #3d4c42; font-size: 25rpx; }.utility-key { color: #3b4944; font-size: 43rpx; }.submit-key { color: #fffefb; background: #ee718d; font-size: 29rpx; }.calendar-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(35, 42, 38, .42); }.calendar-panel { width: 100%; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border: 4rpx solid #303938; border-right: 0; border-bottom: 0; border-left: 0; border-radius: 32rpx 32rpx 0 0; background: #fffef8; box-sizing: border-box; }.calendar-handle { width: 72rpx; height: 8rpx; margin: 0 auto 23rpx; border-radius: 10rpx; background: #b2b6ac; }.calendar-topbar { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 24rpx; }.calendar-title { color: #293630; font-size: 34rpx; font-weight: 700; }.calendar-current { color: #878d82; font-size: 24rpx; }.calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26rpx; }.nav-button { width: 70rpx; color: #293630; font-size: 68rpx; line-height: 1; text-align: center; }.calendar-heading { color: #293630; font-size: 32rpx; font-weight: 700; }.weekdays,.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }.calendar-grid { grid-auto-rows: 86rpx; }.weekdays { margin-bottom: 12rpx; }.weekdays text { color: #899087; font-size: 24rpx; text-align: center; }.calendar-day { display: flex; align-items: center; justify-content: center; box-sizing: border-box; height: 74rpx; min-height: 0; margin: 5rpx; border-radius: 50%; color: #3b4642; font-size: 28rpx; }.calendar-day.calendar-empty { pointer-events: none; }.calendar-day.today { color: #da637b; font-weight: 700; }.calendar-day.selected { border: 3rpx solid #303938; color: #fffef8; background: #ef718d; box-shadow: 0 4rpx 0 rgba(48, 57, 56, .25); }.calendar-day.selected.today { color: #fffef8; }

/* 与账本页面一致的蓝白主题覆盖 */
.page { background: #f5f7fb; background-image: none; }
.book-header { margin: 0 24rpx 20rpx; padding: 24rpx 28rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }
.book-illustration { font-size: 48rpx; }.book-title { color: #1d2939; }.book-subtitle { color: #98a2b3; }.book-icon { font-size: 38rpx; }.back-button { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 16rpx; color: #1677ff; background: #eff6ff; font-size: 58rpx; font-weight: 400; line-height: 1; }
.type-switch { gap: 0; margin: 0 24rpx 24rpx; overflow: hidden; border-radius: 20rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }.type { flex: 1; padding: 22rpx 0; color: #667085; font-size: 30rpx; text-align: center; }.type.active-expense,.type.active-income { color: #1677ff; background: #eff6ff; }.type.active-expense::after,.type.active-income::after { right: 45%; bottom: 8rpx; left: 45%; width: auto; height: 5rpx; border-radius: 8rpx; background: #1677ff; box-shadow: none; transform: none; }
.category-section { margin: 0 24rpx 20rpx; padding: 28rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 8rpx 28rpx rgba(36, 58, 99, .05); }.category-grid { row-gap: 28rpx; column-gap: 16rpx; }.category-icon { width: 94rpx; height: 94rpx; border: 2rpx solid #e4e7ec; background: #f8fafc; }.category-icon text { font-size: 48rpx; }.category-name { color: #475467; font-size: 24rpx; }.category-item.selected .category-icon { border: 4rpx solid #1677ff; background: #eff6ff; box-shadow: 0 6rpx 14rpx rgba(22, 119, 255, .16); transform: scale(1.04); }.category-item.selected .category-name { color: #1677ff; }.category-dots { margin: 28rpx 0 4rpx; }.category-dots text { background: #d0d5dd; }.category-dots .active-dot { background: #1677ff; }.empty-category { color: #98a2b3; }
.entry-panel { margin-top: auto; padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e4e7ec; background: #fff; box-shadow: 0 -8rpx 24rpx rgba(36, 58, 99, .06); }.entry-row { margin-bottom: 16rpx; }.note-icon { width: 76rpx; height: 76rpx; margin-right: 14rpx; border: 0; color: #1677ff; background: #eff6ff; font-size: 40rpx; }.note-input { height: 82rpx; border: 0; border-radius: 16rpx 0 0 16rpx; color: #344054; background: #f7f8fa; }.amount-display { min-width: 190rpx; height: 82rpx; border: 0; border-radius: 0 16rpx 16rpx 0; color: #1677ff; background: #f7f8fa; font-size: 40rpx; }.currency { font-size: 29rpx; }.keypad { gap: 12rpx; }.key { height: 104rpx; border: 1rpx solid #e4e7ec; border-radius: 16rpx; color: #344054; background: #f8fafc; box-shadow: none; font-size: 36rpx; }.key:active { background: #eff6ff; box-shadow: none; transform: none; }.date-key,.utility-key { color: #1677ff; background: #eff6ff; }.date-key { font-size: 24rpx; }.utility-key { font-size: 40rpx; }.submit-key { color: #fff; background: #1677ff; font-size: 28rpx; }.calendar-mask { background: rgba(16, 24, 40, .45); }.calendar-panel { border: 0; background: #fff; }.calendar-title,.calendar-heading,.nav-button { color: #1d2939; }.calendar-current,.weekdays text { color: #98a2b3; }.calendar-day { color: #344054; }.calendar-day.today { color: #1677ff; }.calendar-day.selected { border: 0; color: #fff; background: #1677ff; box-shadow: 0 6rpx 14rpx rgba(22, 119, 255, .22); }.calendar-day.selected.today { color: #fff; }
</style>
