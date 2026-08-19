import { reactive } from 'vue'
import { APP_PROFILE_KEY, APP_TOKEN_KEY } from '../config'

const parseProfile = () => {
  const value = uni.getStorageSync(APP_PROFILE_KEY)
  if (!value) return null
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null }
}

export const authStore = reactive({
  token: '',
  profile: null,
  restore() {
    this.token = uni.getStorageSync(APP_TOKEN_KEY) || ''
    this.profile = parseProfile()
  },
  setLogin(token, profile) {
    this.token = token
    this.profile = profile
    uni.setStorageSync(APP_TOKEN_KEY, token)
    uni.setStorageSync(APP_PROFILE_KEY, JSON.stringify(profile))
  },
  setProfile(profile) {
    this.profile = profile
    uni.setStorageSync(APP_PROFILE_KEY, JSON.stringify(profile))
  },
  clear() {
    this.token = ''
    this.profile = null
    uni.removeStorageSync(APP_TOKEN_KEY)
    uni.removeStorageSync(APP_PROFILE_KEY)
  }
})

authStore.restore()
