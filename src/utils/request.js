import { API_BASE_URL } from '../config'
import { authStore } from '../stores/auth'

export function redirectToLogin() {
  authStore.clear()
  const pages = getCurrentPages()
  if (pages[pages.length - 1]?.route !== 'pages/auth/login') {
    uni.reLaunch({ url: '/pages/auth/login' })
  }
}

let refreshPromise = null

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  if (!authStore.refreshToken) {
    return Promise.reject(new Error('登录已过期，请重新登录'))
  }

  refreshPromise = new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}/api/v1/app/token/refresh`,
      method: 'POST',
      data: { refreshToken: authStore.refreshToken },
      timeout: 15000,
      header: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      success: ({ statusCode, data }) => {
        if (statusCode < 200 || statusCode >= 300 || !data?.token || !data?.refreshToken) {
          reject(new Error(data?.msg || data?.message || '登录已过期，请重新登录'))
          return
        }
        authStore.setTokens(data.token, data.refreshToken)
        resolve()
      },
      fail: ({ errMsg = '' } = {}) => reject(new Error(errMsg.includes('timeout') ? '登录状态刷新超时，请检查网络后重试' : '网络连接失败，请检查服务地址'))
    })
  }).finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

export function request({ url, method = 'GET', data, unwrapResult = false, header = {}, retryOnUnauthorized = true, refreshRound = 0 }) {
  const sentToken = authStore.token
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${url}`,
      method,
      data,
      timeout: 15000,
      header: {
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(authStore.token ? { 'X-App-Token': authStore.token } : {}),
        ...header
      },
      success: ({ statusCode, data: body }) => {
        if (statusCode === 401) {
          // retryOnUnauthorized=false 用于公开端点（登录/发码/注册/重置密码）：
          // 这类 401 不是会话失效，不触发刷新重试，也不能把用户踢回登录页。
          if (retryOnUnauthorized && refreshRound < 2) {
            // 竞态防护：请求发出后若 token 已被其他并发请求的刷新轮换，直接用新 token 重试，
            // 不再发起二次刷新——否则轮换会作废前一次重试所用的 token，导致用户被误踢回登录页。
            const step = (sentToken && authStore.token !== sentToken)
              ? Promise.resolve()
              : refreshAccessToken()
            step
              .then(() => request({ url, method, data, unwrapResult, header, retryOnUnauthorized, refreshRound: refreshRound + 1 }))
              .then(resolve)
              .catch((error) => {
                redirectToLogin()
                reject(error)
              })
            return
          }
          reject(new Error(body?.msg || body?.message || '请求失败'))
          return
        }
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(body?.msg || body?.message || '请求失败'))
          return
        }
        if (unwrapResult) {
          if (body?.code !== 0) {
            reject(new Error(body?.msg || '操作失败'))
            return
          }
          resolve(body.data)
          return
        }
        resolve(body)
      },
      fail: ({ errMsg = '' } = {}) => reject(new Error(errMsg.includes('timeout') ? '请求超时，请检查网络后重试' : '网络连接失败，请检查服务地址'))
    })
  })
}

export function showRequestError(error) {
  uni.showToast({ title: error?.message || '操作失败', icon: 'none', duration: 2200 })
}
