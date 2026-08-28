<script>
import { authStore } from './stores/auth'
import { themeStore } from './stores/theme'

export default {
  onLaunch() {
    themeStore.restore()
    authStore.restore()
    // #ifdef APP-PLUS
    try { uni.hideTabBar({ animation: false }) } catch { /* 平台不支持时忽略 */ }
    // #endif
    if (authStore.token) uni.switchTab({ url: '/pages/ledger/index' })
  }
}
</script>

<style lang="scss">
/* uview-plus 的全局样式会读取这些 Sass 变量。直接在根样式声明以兼容当前 Uni/Vite 编译链。 */
$u-main-color: #303133;
$u-content-color: #606266;
$u-tips-color: #909193;
$u-light-color: #c0c4cc;
$u-border-color: #dadbde;
$u-bg-color: #f3f4f6;
$u-disabled-color: #c8c9cc;
$u-primary: #3c9cff;
$u-primary-dark: #398ade;
$u-primary-disabled: #9acafc;
$u-primary-light: #ecf5ff;
$u-warning: #f9ae3d;
$u-warning-dark: #f1a532;
$u-warning-disabled: #f9d39b;
$u-warning-light: #fdf6ec;
$u-success: #5ac725;
$u-success-dark: #53c21d;
$u-success-disabled: #a9e08f;
$u-success-light: #f5fff0;
$u-error: #f56c6c;
$u-error-dark: #e45656;
$u-error-disabled: #f7b2b2;
$u-error-light: #fef0f0;
$u-info: #909399;
$u-info-dark: #767a82;
$u-info-disabled: #c4c6c9;
$u-info-light: #f4f4f5;

@mixin flex($direction: row) {
  display: flex;
  flex-direction: $direction;
}

@import 'uview-plus/index.scss';

/* App 端（app-plus/小程序）没有 :root 概念，且 CSS 变量继承依赖真实根节点 page。
   把默认主题变量同时声明在 :root 和 page 上，确保各端页面都能稳定继承到浅色默认主题。 */
:root, page {
  --theme-primary: #1677ff;
  --theme-primary-end: #5c9dff;
  --theme-primary-soft: #eaf3ff;
  --theme-primary-shadow: rgba(22, 119, 255, .26);
  --theme-page-bg: #f5f7fb;
  --theme-surface: #ffffff;
  --theme-text: #1d2939;
  --theme-text-strong: #344054;
  --theme-text-secondary: #667085;
  --theme-text-muted: #98a2b3;
  --theme-border: #edf0f5;
  --theme-tab-inactive: #8b95a7;
  --theme-tab-active-icon-filter: none;
  --theme-chart-1: #1677ff;
  --theme-chart-2: #5c9dff;
  --theme-chart-3: #69a7ff;
  --theme-chart-4: #8bbcff;
  --theme-chart-5: #a9ceff;
  --theme-chart-6: #c7ddff;
}

/* #ifdef APP-PLUS */
/* App 端隐藏原生 tabBar 后使用自定义 tabBar 组件，--window-bottom 归零。
   用自定义 tabBar 内容高度（不含安全区）替代，安全区由各页面 env(safe-area-inset-bottom) 补足。 */
:root, page { --tab-bar-height: 140rpx; }
/* #endif */

page { background: var(--theme-page-bg); color: var(--theme-text); font-size: 28rpx; }

/* App 基座在页面根节点上偶发忽略 CSS 变量背景；主题类提供编译期可解析的背景兜底。 */
.theme-ocean { background: #f5f7fb !important; color: #1d2939 !important; }
.theme-forest { background: #f4faf6 !important; color: #17342a !important; }
.theme-sunset { background: #fff8f3 !important; color: #3b2a21 !important; }
.theme-blossom { background: #fff7fa !important; color: #3b202b !important; }
.theme-violet { background: #181422 !important; color: #f5f0ff !important; }
.theme-obsidian { background: #141210 !important; color: #f3ecdd !important; }
button::after { border: none; }
button { border-radius: var(--theme-radius-control, 16rpx); }
.input { box-sizing: border-box; width: 100%; min-height: 88rpx; padding: 0 24rpx; border-radius: var(--theme-radius-control, 16rpx); color: var(--theme-text-strong); background: var(--theme-surface); }
.card { margin: 24rpx; padding: 28rpx; border-radius: var(--theme-radius-card, 24rpx); background: var(--theme-surface); box-shadow: 0 8rpx 32rpx rgba(36, 58, 99, .06); }

/* 主题装饰语言：深色主题卡片专属描边，浅色主题保持默认 */
.theme-violet .card { border: 1rpx solid var(--theme-border); }
.theme-obsidian .card { border: 1rpx solid rgba(217, 166, 72, .3); box-shadow: 0 8rpx 28rpx rgba(0, 0, 0, .32); }
.primary-button { color: #fff; background: var(--theme-primary); }
.danger-button { color: #ef4444; background: #fff1f2; }
.muted { color: var(--theme-text-muted); }
.empty { padding: 90rpx 24rpx; color: var(--theme-text-muted); text-align: center; }

/* H5 使用 Uni 内置 tabBar。默认实现会以 *-active.png 切换选中图标，但不会增加 active class。 */
.uni-tabbar__label { font-size: 16px !important; line-height: 1.5 !important; }
.uni-tabbar__icon img[src*="-active.png"] { filter: var(--theme-tab-active-icon-filter) !important; }
.uni-tabbar__item:has(.uni-tabbar__icon img[src*="-active.png"]) .uni-tabbar__label { color: var(--theme-primary) !important; }
</style>
