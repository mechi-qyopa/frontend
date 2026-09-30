<template>
  <view :class="['page', `theme-${themeStore.id}`]" :key="themeStore.id" :style="themeStore.pageStyle">
    <view class="filter-card">
      <view class="page-title">月度账单</view>
    </view>

    <view v-if="loading" class="loading">加载中…</view>

    <view v-else-if="!reports.length" class="empty-state">
      <text>还没有月度报告</text>
      <text class="empty-sub">每月 1 号 8 点自动生成上月报告</text>
    </view>

    <scroll-view v-else scroll-y class="report-list">
      <view v-for="item in reports" :key="item.id" class="card report-card press" @click="goDetail(item)">
        <view class="report-head">
          <text class="report-title">{{ item.title }}</text>
          <text class="report-month">{{ item.reportMonth }}</text>
        </view>
        <view class="report-body">
          <view class="report-row">
            <text class="report-label">总支出</text>
            <text class="report-value expense">¥{{ item.expenseTotal }}</text>
          </view>
          <view class="report-row">
            <text class="report-label">总收入</text>
            <text class="report-value income">¥{{ item.incomeTotal }}</text>
          </view>
          <view class="report-row">
            <text class="report-label">净结余</text>
            <text class="report-value" :class="item.netAmount >= 0 ? 'income' : 'expense'">¥{{ item.netAmount }}</text>
          </view>
          <view v-if="item.topCategory" class="report-row">
            <text class="report-label">主要消费</text>
            <text class="report-value">{{ item.topCategory }} ¥{{ item.topCategoryAmount }}</text>
          </view>
        </view>
        <view v-if="item.budgetAmount" class="budget-bar">
          <view class="budget-track"><view class="budget-fill" :class="budgetUsage(item) > 100 ? 'over' : budgetUsage(item) >= 80 ? 'warn' : ''" :style="{ width: `${Math.min(100, budgetUsage(item))}%` }" /></view>
          <text class="budget-text">预算 ¥{{ item.budgetAmount }} · 已用 {{ budgetUsage(item) }}%</text>
        </view>
        <view class="report-footer">
          <text class="report-count">{{ item.transactionCount }} 笔流水</text>
          <text class="report-action">查看 AI 分析 ›</text>
        </view>
      </view>
    </scroll-view>

    <!-- #ifdef APP-PLUS -->
    <custom-tab-bar />
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'
// #ifdef APP-PLUS
import CustomTabBar from '../../custom-tab-bar/index.vue'
// #endif

const loading = ref(true)
const reports = ref([])

function budgetUsage(item) {
  if (!item.budgetAmount || Number(item.budgetAmount) <= 0) return 0
  return Math.round((Number(item.expenseTotal) / Number(item.budgetAmount)) * 100)
}

function goDetail(item) {
  uni.navigateTo({ url: `/pages/ledger/monthly-report-detail?id=${item.id}` })
}

async function load() {
  loading.value = true
  try {
    reports.value = await appApi.listMonthlyReports()
  } catch (error) {
    showRequestError(error)
  } finally {
    loading.value = false
  }
}

onShow(load)
</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx; background: var(--theme-bg); box-sizing: border-box; }
.filter-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; padding: 24rpx 28rpx; border-radius: var(--theme-radius-card); background: var(--theme-surface); box-shadow: var(--elev-1); }
.page-title { font-size: var(--font-title); font-weight: 700; color: var(--theme-text); }
.loading { display: flex; align-items: center; justify-content: center; padding: 80rpx 0; color: var(--theme-text-muted); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 120rpx 0; color: var(--theme-text-muted); }
.empty-sub { margin-top: 12rpx; font-size: var(--font-caption); color: var(--theme-text-muted); }
.report-list { flex: 1; }
.report-card { margin-bottom: 24rpx; padding: 28rpx; }
.report-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.report-title { font-size: var(--font-md); font-weight: 600; color: var(--theme-text); }
.report-month { font-size: var(--font-caption); color: var(--theme-text-muted); }
.report-body { margin-bottom: 16rpx; }
.report-row { display: flex; align-items: center; justify-content: space-between; padding: 8rpx 0; }
.report-label { font-size: var(--font-caption); color: var(--theme-text-muted); }
.report-value { font-size: var(--font-body); font-weight: 600; }
.report-value.expense { color: var(--theme-expense); }
.report-value.income { color: var(--theme-income); }
.budget-bar { margin-bottom: 16rpx; padding: 16rpx 0; border-top: 1rpx solid var(--theme-border); }
.budget-track { height: 12rpx; margin-bottom: 8rpx; border-radius: 999rpx; background: var(--theme-border); overflow: hidden; }
.budget-fill { height: 100%; border-radius: 999rpx; background: var(--theme-primary); transition: width .3s ease; }
.budget-fill.warn { background: #f59e0b; }
.budget-fill.over { background: var(--theme-expense); }
.budget-text { font-size: var(--font-caption); color: var(--theme-text-muted); }
.report-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16rpx; border-top: 1rpx solid var(--theme-border); }
.report-count { font-size: var(--font-caption); color: var(--theme-text-muted); }
.report-action { font-size: var(--font-caption); color: var(--theme-primary); }
</style>
