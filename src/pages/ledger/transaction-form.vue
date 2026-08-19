<template>
  <view class="page">
    <view class="type-switch"><view :class="['type', form.transactionType === 'EXPENSE' && 'active-expense']" @click="selectType('EXPENSE')">支出</view><view :class="['type', form.transactionType === 'INCOME' && 'active-income']" @click="selectType('INCOME')">收入</view></view>
    <view class="card"><text class="label">金额</text><view class="amount-row"><text>¥</text><input v-model="form.amount" type="digit" placeholder="0.00" /></view></view>
    <view class="card field"><text>分类</text><picker :range="filteredCategories" range-key="label" @change="selectCategory"><view class="picker-value">{{ selectedCategory?.label || '请选择分类' }} <text>›</text></view></picker></view>
    <view class="card field"><text>日期</text><view class="picker-value date-trigger" @click="openCalendar">{{ form.occurredOn }} <text>›</text></view></view>
    <view class="card field note"><text>备注</text><input v-model.trim="form.note" placeholder="可填写备注" maxlength="255" /></view>
    <button class="primary-button submit" :loading="submitting" @click="submit">保存流水</button>

    <view v-if="calendarVisible" class="calendar-mask" @click.self="closeCalendar">
      <view class="calendar-panel">
        <view class="calendar-handle" />
        <text class="calendar-title">选择日期</text>
        <view class="calendar-nav"><text class="nav-button" @click="previousMonth">‹</text><text class="calendar-heading">{{ calendarYear }}年{{ calendarMonth + 1 }}月</text><text class="nav-button" @click="nextMonth">›</text></view>
        <view class="weekdays"><text v-for="weekday in weekdays" :key="weekday">{{ weekday }}</text></view>
        <view class="calendar-grid"><view v-for="(cell, index) in calendarCells" :key="`${cell.day || 'blank'}-${index}`" :class="['calendar-day', { empty: !cell.day, selected: isSelectedDate(cell.day), today: isToday(cell.day) }]" @click="cell.day && selectDate(cell.day)">{{ cell.day || '' }}</view></view>
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
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const form = reactive({ categoryId: null, categorySource: null, transactionType: 'EXPENSE', amount: '', occurredOn: formatDate(new Date()), note: '' })
const filteredCategories = computed(() => categories.value.filter(item => item.transactionType === form.transactionType && (item.source !== 'SYSTEM' || item.status === 'ACTIVE')).map(item => ({ ...item, label: `${item.name}${item.source === 'SYSTEM' ? '（系统）' : '（自定义）'}` })))
const selectedCategory = computed(() => filteredCategories.value.find(item => item.id === form.categoryId && item.source === form.categorySource))
const calendarCells = computed(() => {
  const firstWeekday = (new Date(calendarYear.value, calendarMonth.value, 1).getDay() + 6) % 7
  const daysInMonth = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate()
  return [...Array.from({ length: firstWeekday }, () => ({})), ...Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1 }))]
})

onLoad(load)
async function load() { try { categories.value = await appApi.listCategories() } catch (error) { showRequestError(error) } }
function selectType(type) { form.transactionType = type; form.categoryId = null; form.categorySource = null }
function selectCategory(event) { const item = filteredCategories.value[Number(event.detail.value)]; form.categoryId = item?.id || null; form.categorySource = item?.source || null }
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
  if (!/^\d+(\.\d{1,2})?$/.test(form.amount) || Number(form.amount) <= 0) return uni.showToast({ title: '请输入正确金额', icon: 'none' })
  submitting.value = true
  try { await appApi.createTransaction({ ...form, amount: form.amount, note: form.note || null }); uni.showToast({ title: '已保存', icon: 'success' }); setTimeout(() => uni.navigateBack(), 450) } catch (error) { showRequestError(error) } finally { submitting.value = false }
}
</script>

<style scoped>
.page { padding: 24rpx; }.type-switch { display: flex; overflow: hidden; margin-bottom: 24rpx; border-radius: 20rpx; background: #fff; }.type { flex: 1; padding: 24rpx; color: #667085; text-align: center; }.active-expense { color: #e11d48; font-weight: 600; background: #fff1f2; }.active-income { color: #16a34a; font-weight: 600; background: #dcfce7; }.card { padding: 28rpx; border-radius: 24rpx; background: #fff; }.label { color: #667085; font-size: 26rpx; }.amount-row { display: flex; align-items: baseline; margin-top: 14rpx; color: #1d2939; font-size: 52rpx; font-weight: 600; }.amount-row input { flex: 1; margin-left: 16rpx; font-size: 52rpx; }.field { display: flex; align-items: center; justify-content: space-between; margin-top: 20rpx; }.field > text { color: #344054; }.picker-value { min-width: 300rpx; color: #667085; text-align: right; }.picker-value text { margin-left: 14rpx; color: #98a2b3; font-size: 34rpx; }.date-trigger { padding: 6rpx 0; }.field input { width: 350rpx; color: #667085; text-align: right; }.note input { text-align: right; }.submit { margin-top: 52rpx; height: 90rpx; line-height: 90rpx; }.calendar-mask { position: fixed; z-index: 1000; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(0,0,0,.5); }.calendar-panel { width: 100%; padding: 18rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); border-radius: 32rpx 32rpx 0 0; background: #fff; box-sizing: border-box; }.calendar-handle { width: 72rpx; height: 8rpx; margin: 0 auto 30rpx; border-radius: 10rpx; background: #e4e7ec; }.calendar-title { display: block; margin-bottom: 24rpx; color: #1d2939; font-size: 34rpx; font-weight: 600; text-align: center; }.calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26rpx; }.nav-button { width: 70rpx; color: #1d2939; font-size: 68rpx; line-height: 1; text-align: center; }.calendar-heading { color: #1d2939; font-size: 32rpx; font-weight: 600; }.weekdays,.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }.weekdays { margin-bottom: 12rpx; }.weekdays text { color: #98a2b3; font-size: 24rpx; text-align: center; }.calendar-day { display: flex; align-items: center; justify-content: center; height: 80rpx; margin: 3rpx; border-radius: 50%; color: #344054; font-size: 28rpx; }.calendar-day.empty { pointer-events: none; }.calendar-day.today { color: #1677ff; font-weight: 600; }.calendar-day.selected { color: #fff; background: #1677ff; box-shadow: 0 8rpx 16rpx rgba(22,119,255,.22); }.calendar-day.selected.today { color: #fff; }
</style>
