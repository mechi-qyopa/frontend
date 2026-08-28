import { reactive } from 'vue'
import { APP_THEME_KEY } from '../config'

export const THEMES = [
  {
    id: 'ocean',
    name: '海洋蓝',
    description: '清爽、专注的默认外观',
    icons: { tab: ['file-text', 'column-line', 'chat', 'account'] },
    shape: { card: '24rpx', control: '16rpx' },
    colors: { primary: '#1677ff', primaryEnd: '#5c9dff', primarySoft: '#eaf3ff', primaryShadow: 'rgba(22, 119, 255, .26)', pageBackground: '#f5f7fb', surface: '#ffffff', text: '#1d2939', textStrong: '#344054', textSecondary: '#667085', textMuted: '#98a2b3', border: '#edf0f5', chart: ['#1677ff', '#5c9dff', '#69a7ff', '#8bbcff', '#a9ceff', '#c7ddff'], tabInactive: '#8b95a7' }
  },
  {
    id: 'forest',
    name: '森林绿',
    description: '自然、平静的记录体验',
    icons: { tab: ['order', 'calendar', 'kefu-ermai', 'setting'] },
    shape: { card: '30rpx', control: '20rpx' },
    colors: { primary: '#159b70', primaryEnd: '#4cc38c', primarySoft: '#e7f8f0', primaryShadow: 'rgba(21, 155, 112, .26)', pageBackground: '#f4faf6', surface: '#ffffff', text: '#17342a', textStrong: '#28513f', textSecondary: '#668076', textMuted: '#92a59d', border: '#e3eee8', chart: ['#159b70', '#4cc38c', '#79d4a7', '#9be3c1', '#bcebd5', '#d8f3e4'], tabInactive: '#82968d' }
  },
  {
    id: 'sunset',
    name: '日落橙',
    description: '温暖、积极的消费洞察',
    icons: { tab: ['tags', 'integral', 'chat', 'account'] },
    shape: { card: '18rpx', control: '12rpx' },
    colors: { primary: '#ef7a32', primaryEnd: '#f7ad55', primarySoft: '#fff1e7', primaryShadow: 'rgba(239, 122, 50, .26)', pageBackground: '#fff8f3', surface: '#ffffff', text: '#3b2a21', textStrong: '#5c4030', textSecondary: '#846b5d', textMuted: '#ab968a', border: '#f5e8df', chart: ['#ef7a32', '#f7ad55', '#f6be79', '#f9cf9b', '#fbe0bb', '#fcebd5'], tabInactive: '#9b8a7e' }
  },
  {
    id: 'blossom',
    name: '樱花粉',
    description: '柔和、轻盈的日常记账',
    icons: { tab: ['list-dot', 'heart', 'chat', 'star'] },
    shape: { card: '32rpx', control: '22rpx' },
    colors: { primary: '#e85d8c', primaryEnd: '#f28bb0', primarySoft: '#fff0f5', primaryShadow: 'rgba(232, 93, 140, .26)', pageBackground: '#fff7fa', surface: '#ffffff', text: '#3b202b', textStrong: '#5b3141', textSecondary: '#8a6572', textMuted: '#b395a0', border: '#f6e3ea', chart: ['#e85d8c', '#f28bb0', '#f5acc5', '#ef78a2', '#f8c6d8', '#fbe0e9'], tabInactive: '#a48b95' }
  },
  {
    id: 'violet',
    name: '夜幕紫',
    description: '克制、沉稳的深色界面',
    dark: true,
    icons: { tab: ['home', 'column-line', 'chat', 'setting'] },
    shape: { card: '20rpx', control: '14rpx' },
    colors: { primary: '#9c6cff', primaryEnd: '#c28cff', primarySoft: '#2b2340', primaryShadow: 'rgba(156, 108, 255, .34)', pageBackground: '#181422', surface: '#251f33', text: '#f5f0ff', textStrong: '#e4d9f6', textSecondary: '#b8aacd', textMuted: '#9184a7', border: '#382f4b', chart: ['#9c6cff', '#c28cff', '#d7adff', '#a98ae6', '#785bb2', '#563f86'], tabInactive: '#9d91b2' }
  },
  {
    id: 'obsidian',
    name: '曜石黑金',
    description: '深邃黑底与琥珀金，低调的奢华',
    dark: true,
    icons: { tab: ['rmb-circle', 'integral', 'kefu-ermai', 'account'] },
    shape: { card: '12rpx', control: '8rpx' },
    colors: { primary: '#d9a648', primaryEnd: '#f2cd7b', primarySoft: '#2e2716', primaryShadow: 'rgba(217, 166, 72, .3)', pageBackground: '#141210', surface: '#211d17', text: '#f3ecdd', textStrong: '#e7ddc6', textSecondary: '#b0a68c', textMuted: '#847a63', border: '#332d21', chart: ['#d9a648', '#f2cd7b', '#b8873a', '#8f6a2b', '#f4dfa4', '#6e5522'], tabInactive: '#8a8171' }
  }
]

const DEFAULT_THEME_ID = THEMES[0].id

// H5 内置 tabBar 的选中图标是蓝色位图；按主题色转换其色相，使位图与运行时主题保持一致。
const TAB_ACTIVE_ICON_FILTERS = {
  ocean: 'none',
  forest: 'hue-rotate(-53deg) saturate(.82) brightness(.61)',
  sunset: 'hue-rotate(168deg) saturate(.79) brightness(.94)',
  blossom: 'hue-rotate(128deg) saturate(.65) brightness(.91)',
  violet: 'hue-rotate(46deg) saturate(.75) brightness(1.28)',
  obsidian: 'hue-rotate(-170deg) saturate(.6) brightness(1.06)'
}

const resolveTheme = (id) => THEMES.find((theme) => theme.id === id) || THEMES[0]

function cssVariables(theme) {
  const colors = theme.colors
  return {
    '--theme-primary': colors.primary,
    '--theme-primary-end': colors.primaryEnd,
    '--theme-primary-soft': colors.primarySoft,
    '--theme-primary-shadow': colors.primaryShadow,
    '--theme-radius-card': theme.shape.card,
    '--theme-radius-control': theme.shape.control,
    '--theme-page-bg': colors.pageBackground,
    '--theme-surface': colors.surface,
    '--theme-text': colors.text,
    '--theme-text-strong': colors.textStrong,
    '--theme-text-secondary': colors.textSecondary,
    '--theme-text-muted': colors.textMuted,
    '--theme-border': colors.border,
    '--theme-tab-inactive': colors.tabInactive,
    '--theme-tab-active-icon-filter': TAB_ACTIVE_ICON_FILTERS[theme.id],
    '--theme-chart-1': colors.chart[0],
    '--theme-chart-2': colors.chart[1],
    '--theme-chart-3': colors.chart[2],
    '--theme-chart-4': colors.chart[3],
    '--theme-chart-5': colors.chart[4],
    '--theme-chart-6': colors.chart[5]
  }
}

function applyDocumentTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  Object.entries(cssVariables(theme)).forEach(([name, value]) => root.style.setProperty(name, value))
  root.dataset.mechiTheme = theme.id
}

let cachedAndroid = null

function isAndroidApp() {
  // #ifdef APP-PLUS
  if (cachedAndroid === null) cachedAndroid = plus.os.name === 'Android'
  return cachedAndroid
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

function applyStatusBar(theme) {
  // #ifdef APP-PLUS
  const isDark = !!theme.dark
  // Android：小米 HyperOS/MIUI 等国产 ROM 对 plus.navigator.setStatusBarStyle 常不生效，
  // 通过原生 decorView systemUiVisibility + window flag 双通道控制图标明暗。
  // 注意：页面切换动画期间频繁跨线程写 window 易引发原生异常，故先读后写、状态一致则跳过。
  if (isAndroidApp()) {
    try {
      const main = plus.android.runtimeMainActivity()
      plus.android.importClass(main)
      const window = main.getWindow()
      plus.android.importClass(window)
      const decorView = window.getDecorView()
      plus.android.importClass(decorView)
      // SYSTEM_UI_FLAG_LIGHT_STATUS_BAR：置位=深色图标（浅色外观），清除=白色图标
      const FLAG_LIGHT = 0x00002000
      const current = Number(decorView.getSystemUiVisibility()) || 0
      const target = isDark ? (current & ~FLAG_LIGHT) : (current | FLAG_LIGHT)
      if (target !== current) {
        decorView.setSystemUiVisibility(target)
        // WindowManager.LayoutParams.FLAG_LIGHT_STATUS_BAR（API 27+），双保险
        const FLAG_LIGHT_STATUS_BAR = 0x00800000
        if (isDark) {
          window.clearFlags(FLAG_LIGHT_STATUS_BAR)
        } else {
          window.addFlags(FLAG_LIGHT_STATUS_BAR)
        }
      }
    } catch (error) {
      console.log('[theme] setStatusBarStyle failed:', error)
    }
  } else {
    try { plus.navigator.setStatusBarStyle(isDark ? 'light' : 'dark') } catch { /* 平台不支持时忽略 */ }
  }
  try { plus.navigator.setStatusBarBackground(theme.colors.pageBackground) } catch { /* 平台不支持时忽略 */ }
  // #endif
}

function applyNativeTheme(theme) {
  const colors = theme.colors
  const isDark = !!theme.dark
  // #ifdef APP-PLUS
  try { uni.hideTabBar({ animation: false }) } catch { /* 平台不支持时忽略 */ }
  applyStatusBar(theme)
  // #endif
  try { uni.setNavigationBarColor({ frontColor: isDark ? '#ffffff' : '#000000', backgroundColor: colors.surface }) } catch { /* 当前平台不支持时使用 pages.json 默认值 */ }
  try { uni.setTabBarStyle({ color: colors.tabInactive, selectedColor: colors.primary, backgroundColor: colors.surface, borderStyle: isDark ? 'black' : 'white' }) } catch { /* 非 tab 页面或当前平台不支持时忽略 */ }
}

export const themeStore = reactive({
  id: DEFAULT_THEME_ID,
  // App 端自定义 tabBar 实测总高（px，含安全区），由组件挂载后测量回填，供页面精确布局
  appTabBar: { heightPx: 0 },
  get currentTheme() {
    return resolveTheme(this.id)
  },
  get pageStyle() {
    const colors = this.currentTheme.colors
    return { ...cssVariables(this.currentTheme), backgroundColor: colors.pageBackground, color: colors.text }
  },
  get cssVariables() {
    return cssVariables(this.currentTheme)
  },
  restore() {
    const storedId = uni.getStorageSync(APP_THEME_KEY)
    this.id = resolveTheme(storedId).id
    applyDocumentTheme(this.currentTheme)
    applyNativeTheme(this.currentTheme)
  },
  setTheme(id) {
    const theme = resolveTheme(id)
    this.id = theme.id
    uni.setStorageSync(APP_THEME_KEY, theme.id)
    applyDocumentTheme(theme)
    applyNativeTheme(theme)
  },
  syncStatusBar() {
    applyStatusBar(this.currentTheme)
  }
})
