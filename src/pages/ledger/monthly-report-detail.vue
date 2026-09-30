<template>
  <view :class="['page', `theme-${themeStore.id}`]" :key="themeStore.id" :style="themeStore.pageStyle">
    <view class="filter-card">
      <view class="page-title">{{ report?.title || '月度账单' }}</view>
    </view>

    <view v-if="loading" class="loading">加载中…</view>

    <view v-else-if="!report" class="empty-state">
      <text>报告不存在或已删除</text>
    </view>

    <scroll-view v-else scroll-y class="detail-scroll">
      <view class="card summary-card">
        <view class="summary-grid">
          <view class="summary-item">
            <text class="summary-label">总支出</text>
            <text class="summary-value expense">¥{{ report.expenseTotal }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">总收入</text>
            <text class="summary-value income">¥{{ report.incomeTotal }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">净结余</text>
            <text class="summary-value" :class="report.netAmount >= 0 ? 'income' : 'expense'">¥{{ report.netAmount }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">记账笔数</text>
            <text class="summary-value">{{ report.transactionCount }} 笔</text>
          </view>
        </view>
        <view v-if="report.budgetAmount" class="budget-section">
          <view class="budget-track"><view class="budget-fill" :class="usagePercent > 100 ? 'over' : usagePercent >= 80 ? 'warn' : ''" :style="{ width: `${Math.min(100, usagePercent)}%` }" /></view>
          <text class="budget-text">预算 ¥{{ report.budgetAmount }} · 已用 {{ usagePercent }}%</text>
        </view>
      </view>

      <view class="card ai-card">
        <view class="ai-header">
          <text class="ai-title">AI 月度分析</text>
        </view>
        <view class="ai-content">
          <rich-text :nodes="formattedSummary" />
        </view>
        <text class="ai-time">生成于 {{ formatTime(report.generatedAt) }}</text>
      </view>

      <view v-if="report.topCategory" class="card top-card">
        <text class="top-title">本月消费 TOP1</text>
        <text class="top-name">{{ report.topCategory }}</text>
        <text class="top-amount">¥{{ report.topCategoryAmount }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'

const loading = ref(true)
const report = ref(null)
const reportId = ref(null)

const usagePercent = computed(() => {
  if (!report.value?.budgetAmount || Number(report.value.budgetAmount) <= 0) return 0
  return Math.round((Number(report.value.expenseTotal) / Number(report.value.budgetAmount)) * 100)
})

const formattedSummary = computed(() => {
  if (!report.value?.summary) return ''
  return report.value.summary.replace(/\n/g, '<br>')
})

function formatTime(iso) {
  if (!iso) return ''
  return iso.replace('T', ' ').slice(0, 16)
}

async function load() {
  loading.value = true
  try {
    report.value = await appApi.getMonthlyReport(reportId.value)
  } catch (error) {
    showRequestError(error)
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  reportId.value = options.id
  load()
})
</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx; background: var(--theme-bg); box-sizing: border-box; }
.filter-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; padding: 24rpx 28rpx; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-1); }
.page-title { font-size: var(--font-title); font-weight: 700; color: var(--theme-text); }
.loading { display: flex; align-items: center; justify-content: center; padding: 80rpx 0; color: var(--theme-text-muted); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 120rpx 0; color: var(--theme-text-muted); }
.detail-scroll { flex: 1; }
.card { margin-bottom: 24rpx; padding: 28rpx; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; margin-bottom: 20rpx; }
.summary-item { display: flex; flex-direction: column; align-items: center; padding: 20rpx; border-radius: var(--theme-radius-card); background: var(--theme-bg); }
.summary-label { font-size: var(--font-caption); color: var(--theme-text-muted); margin-bottom: 8rpx; }
.summary-value { font-size: var(--font-md); font-weight: 700; }
.summary-value.expense { color: var(--theme-expense); }
.summary-value.income { color: var(--theme-income); }
.budget-section { padding-top: 20rpx; border-top: 1rpx solid var(--theme-border); }
.budget-track { height: 12rpx; margin-bottom: 8rpx; border-radius: 999rpx; background: var(--theme-border); overflow: hidden; }
.budget-fill { height: 100%; border-radius: 999rpx; background: var(--theme-primary); transition: width .3s ease; }
.budget-fill.warn { background: #f59e0b; }
.budget-fill.over { background: var(--theme-expense); }
.budget-text { font-size: var(--font-caption); color: var(--theme-text-muted); }
.ai-header { margin-bottom: 20rpx; }
.ai-title { font-size: var(--font-md); font-weight: 600; color: var(--theme-text); }
.ai-content { line-height: 1.8; color: var(--theme-text); font-size: var(--font-body); }
.ai-time { display: block; margin-top: 16rpx; font-size: var(--font-caption); color: var(--theme-text-muted); }
.top-card { text-align: center; padding: 32rpx; }
.top-title { font-size: var(--font-caption); color: var(--theme-text-muted); margin-bottom: 8rpx; }
.top-name { font-size: var(--font-title); font-weight: 700; color: var(--theme-text); margin-bottom: 4rpx; }
.top-amount { font-size: var(--font-md); font-weight: 600; color: var(--theme-expense); }
</style>
