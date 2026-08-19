import { API_BASE_URL } from '../config'
import { authStore } from '../stores/auth'

function redirectToLogin() {
  authStore.clear()
  const pages = getCurrentPages()
  if (pages[pages.length - 1]?.route !== 'pages/auth/login') {
    uni.reLaunch({ url: '/pages/auth/login' })
  }
}

export function request({ url, method = 'GET', data, unwrapResult = false, header = {} }) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${url}`,
      method,
      data,
      header: {
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(authStore.token ? { 'X-App-Token': authStore.token } : {}),
        ...header
      },
      success: ({ statusCode, data: body }) => {
        if (statusCode === 401) {
          redirectToLogin()
          reject(new Error('登录已过期，请重新登录'))
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
      fail: () => reject(new Error('网络连接失败，请检查服务地址'))
    })
  })
}

export function showRequestError(error) {
  uni.showToast({ title: error?.message || '操作失败', icon: 'none', duration: 2200 })
}
