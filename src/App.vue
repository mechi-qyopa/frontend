<script>
import { authStore } from './stores/auth'

export default {
  onLaunch() {
    authStore.restore()
  }
}
</script>

<style>
page { background: #f5f7fb; color: #1d2939; font-size: 28rpx; }
button::after { border: none; }
button { border-radius: 16rpx; }
.input { box-sizing: border-box; width: 100%; min-height: 88rpx; padding: 0 24rpx; border-radius: 16rpx; background: #f7f8fa; }
.card { margin: 24rpx; padding: 28rpx; border-radius: 24rpx; background: #fff; box-shadow: 0 8rpx 32rpx rgba(36, 58, 99, .06); }
.primary-button { color: #fff; background: #1677ff; }
.danger-button { color: #ef4444; background: #fff1f2; }
.muted { color: #7c8799; }
.empty { padding: 90rpx 24rpx; color: #98a2b3; text-align: center; }

/* H5 使用 Uni 内置 tabBar，此选择器需覆盖运行时写入的 10px 内联字号。 */
.uni-tabbar__label { font-size: 16px !important; line-height: 1.5 !important; }
</style>
