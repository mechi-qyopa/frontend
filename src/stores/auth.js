import { reactive } from 'vue'
import { APP_PROFILE_KEY, APP_REFRESH_TOKEN_KEY, APP_TOKEN_KEY } from '../config'

const parseProfile = () => {
  const value = uni.getStorageSync(APP_PROFILE_KEY)
  if (!value) return null
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null }
}

export const authStore = reactive({
  token: '',
  refreshToken: '',
  profile: null,
  restore() {
    this.token = uni.getStorageSync(APP_TOKEN_KEY) || ''
    this.refreshToken = uni.getStorageSync(APP_REFRESH_TOKEN_KEY) || ''
    this.profile = parseProfile()
  },
  setLogin(token, refreshToken, profile) {
    this.setTokens(token, refreshToken)
    this.profile = profile
    uni.setStorageSync(APP_PROFILE_KEY, JSON.stringify(profile))
    uni.$emit('ledger:invalidate', { hard: true })
  },
  setTokens(token, refreshToken) {
    this.token = token
    this.refreshToken = refreshToken
    uni.setStorageSync(APP_TOKEN_KEY, token)
    uni.setStorageSync(APP_REFRESH_TOKEN_KEY, refreshToken)
  },
  setProfile(profile) {
    this.profile = profile
    uni.setStorageSync(APP_PROFILE_KEY, JSON.stringify(profile))
  },
  clear() {
    this.token = ''
    this.refreshToken = ''
    this.profile = null
    uni.removeStorageSync(APP_TOKEN_KEY)
    uni.removeStorageSync(APP_REFRESH_TOKEN_KEY)
    uni.removeStorageSync(APP_PROFILE_KEY)
    uni.$emit('ledger:invalidate', { hard: true })
  }
})

authStore.restore()
