<template>
  <view :class="['budget-page', `theme-${themeStore.id}`]" :style="themeStore.pageStyle">
    <view class="card form-card">
      <text class="section-title">{{ formMonthBudget ? '调整预算' : '设置预算' }}</text>
      <picker mode="date" fields="month" :value="form.month" @change="onMonthChange">
        <view class="field-row press" role="button" aria-label="选择预算月份">
          <text class="field-label">月份</text>
          <text class="field-value">{{ formatMonth(form.month) }}</text>
          <text class="field-arrow">›</text>
        </view>
      </picker>
      <view class="field-row">
        <text class="field-label">金额</text>
        <view class="amount-input">
          <text class="currency">¥</text>
          <input v-model="form.amount" class="amount-field" type="digit" placeholder="0.00" placeholder-class="amount-placeholder" maxlength="12" />
        </view>
      </view>
      <button class="primary-button save" :loading="saving" @click="save">保存预算</button>
      <button v-if="formMonthBudget" class="danger-link" @click="removeBudget">删除该月预算</button>
    </view>

    <view class="card list-card">
      <text class="section-title">历史预算</text>
      <view v-if="!budgets.length && !loading" class="empty">还没有设置过预算，先定一个小目标～</view>
      <view v-for="budget in budgets" :key="budget.id" class="budget-row press" role="button" :aria-label="`编辑${formatMonth(budget.budgetMonth)}预算`" @click="editBudget(budget)">
        <view class="budget-row-head">
          <text class="budget-month">{{ formatMonth(budget.budgetMonth) }}<text v-if="budget.budgetMonth === currentMonth" class="current-tag">本月</text></text>
          <text :class="['budget-remaining', levelClass(budget)]">{{ remainingText(budget) }}</text>
        </view>
        <view class="budget-track"><view class="budget-fill" :class="levelClass(budget)" :style="{ width: barWidth(budget) }" /></view>
        <view class="budget-row-foot"><text>已用 ¥{{ formatAmount(budget.spent) }}</text><text>预算 ¥{{ formatAmount(budget.amount) }} · {{ budget.usagePercent }}%</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { formatAmount } from '../../utils/date'
import { showRequestError } from '../../utils/request'
import { themeStore } from '../../stores/theme'

const budgets = ref([])
const loading = ref(true)
const saving = ref(false)
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const form = reactive({ month: '', amount: '' })
const formMonthBudget = computed(() => budgets.value.find((budget) => budget.budgetMonth === form.month) || null)

onShow(() => {
  if (!form.month) form.month = currentMonth
  load()
})

async function load() {
  loading.value = true
  try {
    budgets.value = await appApi.listBudgets()
  } catch (error) {
    showRequestError(error)
  } finally {
    loading.value = false
  }
}

function onMonthChange(event) { form.month = event.detail.value }
function editBudget(budget) { form.month = budget.budgetMonth; form.amount = String(budget.amount) }

async function save() {
  if (!form.month) return uni.showToast({ title: '请选择月份', icon: 'none' })
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) return uni.showToast({ title: '预算金额需大于 0', icon: 'none' })
  saving.value = true
  try {
    await appApi.saveBudget({ budgetMonth: form.month, amount })
    uni.showToast({ title: '预算已保存', icon: 'success' })
    form.amount = ''
    await load()
  } catch (error) {
    showRequestError(error)
  } finally {
    saving.value = false
  }
}

function removeBudget() {
  const budget = formMonthBudget.value
  if (!budget) return
  uni.showModal({
    title: '删除预算',
    content: `确定删除 ${formatMonth(budget.budgetMonth)} 的预算吗？`,
    confirmColor: '#ef4444',
    success: async ({ confirm }) => {
      if (!confirm) return
      try {
        await appApi.deleteBudget(budget.id)
        if (form.month === budget.budgetMonth) form.amount = ''
        uni.showToast({ title: '已删除', icon: 'success' })
        await load()
      } catch (error) {
        showRequestError(error)
      }
    }
  })
}

function levelClass(budget) { return budget.usagePercent > 100 ? 'over' : budget.usagePercent >= 80 ? 'warn' : '' }
function barWidth(budget) { return `${Math.min(100, Math.max(budget.usagePercent, budget.spent > 0 ? 2 : 0))}%` }
function remainingText(budget) {
  return budget.remaining >= 0 ? `剩 ¥${formatAmount(budget.remaining)}` : `超 ¥${formatAmount(Math.abs(Number(budget.remaining)))}`
}
function formatMonth(month) {
  if (!month) return '请选择'
  const [year, monthPart] = month.split('-')
  return `${year}年${Number(monthPart)}月`
}
</script>

<style scoped>
.budget-page { min-height: 100vh; padding: 24rpx 24rpx 60rpx; background: var(--theme-page-bg); box-sizing: border-box; }
.form-card { margin-bottom: 24rpx; }
.section-title { display: block; margin-bottom: 24rpx; color: var(--theme-text-strong); font-size: var(--font-body); font-weight: 600; }
.field-row { display: flex; align-items: center; justify-content: space-between; padding: 26rpx 4rpx; border-bottom: 1rpx solid var(--theme-border); }
.field-label { color: var(--theme-text-secondary); font-size: var(--font-caption); }
.field-value { flex: 1; margin-left: 32rpx; color: var(--theme-text-strong); font-size: var(--font-caption); text-align: right; }
.field-arrow { margin-left: 8rpx; color: var(--theme-text-muted); font-size: var(--font-caption); }
.amount-input { display: flex; flex: 1; align-items: baseline; justify-content: flex-end; margin-left: 32rpx; }
.currency { margin-right: 10rpx; color: var(--theme-text-secondary); font-size: var(--font-caption); }
.amount-field { width: 320rpx; color: var(--theme-text-strong); font-size: 40rpx; font-weight: 700; text-align: right; }
.amount-placeholder { color: var(--theme-text-muted); font-weight: 400; font-size: 32rpx; }
.save { margin-top: 36rpx; height: 88rpx; line-height: 88rpx; font-size: var(--font-md); }
.danger-link { margin-top: 16rpx; height: 80rpx; line-height: 80rpx; color: var(--theme-expense); background: transparent; font-size: var(--font-caption); }
.danger-link::after { border: none; }
.empty { padding: 40rpx 0; color: var(--theme-text-muted); font-size: var(--font-caption); text-align: center; }
.budget-row { padding: 24rpx 0; border-bottom: 1rpx solid var(--theme-border); }
.budget-row:last-child { border-bottom: none; }
.budget-row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.budget-month { color: var(--theme-text-strong); font-size: var(--font-caption); font-weight: 600; }
.current-tag { margin-left: 12rpx; padding: 4rpx 14rpx; border-radius: 999rpx; color: var(--theme-primary); background: var(--theme-primary-soft); font-size: 20rpx; font-weight: 400; }
.budget-remaining { color: var(--theme-text-secondary); font-size: var(--font-caption); }
.budget-track { height: 14rpx; border-radius: 999rpx; background: var(--theme-border); overflow: hidden; }
.budget-fill { height: 100%; border-radius: 999rpx; background: var(--theme-primary); transition: width .3s ease; }
.budget-fill.warn { background: #f59e0b; }
.budget-fill.over { background: var(--theme-expense); }
.budget-row-foot { display: flex; justify-content: space-between; margin-top: 14rpx; color: var(--theme-text-muted); font-size: var(--font-caption); }
</style>
