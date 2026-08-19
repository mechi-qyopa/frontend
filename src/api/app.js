import { API_BASE_URL } from '../config'
import { authStore } from '../stores/auth'
import { request } from '../utils/request'

function redirectToLogin() {
  authStore.clear()
  const pages = getCurrentPages()
  if (pages[pages.length - 1]?.route !== 'pages/auth/login') {
    uni.reLaunch({ url: '/pages/auth/login' })
  }
}

function consumeSseEvents(buffer, onToken) {
  const events = buffer.split(/\r?\n\r?\n/)
  const remainder = events.pop()
  events.forEach((event) => {
    const token = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    if (token) onToken(token.replace(/\\n/g, '\n'))
  })
  return remainder
}

async function streamChat(data, onToken) {
  if (typeof fetch !== 'function') {
    const response = await request({ url: '/api/v1/app/chat', method: 'POST', data })
    if (!response.success) throw new Error(response.error || '暂时无法回复')
    onToken(response.reply)
    return
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/app/chat/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...(authStore.token ? { 'X-App-Token': authStore.token } : {})
    },
    body: JSON.stringify(data)
  })
  if (response.status === 401) {
    redirectToLogin()
    throw new Error('登录已过期，请重新登录')
  }
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || '流式请求失败')
  }
  if (!response.body) throw new Error('当前环境不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    buffer = consumeSseEvents(buffer, onToken)
    if (done) break
  }
  if (buffer.trim()) consumeSseEvents(`${buffer}\n\n`, onToken)
}

async function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}/api/v1/app/storage/images`,
      filePath,
      name: 'file',
      header: {
        Accept: 'application/json',
        ...(authStore.token ? { 'X-App-Token': authStore.token } : {})
      },
      success: ({ statusCode, data }) => {
        let body
        try { body = typeof data === 'string' ? JSON.parse(data) : data } catch { body = null }
        if (statusCode === 401) {
          redirectToLogin()
          reject(new Error('登录已过期，请重新登录'))
          return
        }
        if (statusCode < 200 || statusCode >= 300 || !body?.url) {
          reject(new Error(body?.msg || '头像上传失败'))
          return
        }
        resolve(body.url)
      },
      fail: () => reject(new Error('头像上传失败，请检查网络连接'))
    })
  })
}

export const appApi = {
  register: (data) => request({ url: '/api/v1/app/register', method: 'POST', data }),
  login: (data) => request({ url: '/api/v1/app/login', method: 'POST', data }),
  logout: () => request({ url: '/api/v1/app/logout', method: 'POST' }),
  getMe: () => request({ url: '/api/v1/app/me' }),
  updateMe: (data) => request({ url: '/api/v1/app/me', method: 'PATCH', data }),

  listCategories: () => request({ url: '/api/v1/app/bookkeeping/categories', unwrapResult: true }),
  createCategory: (data) => request({ url: '/api/v1/app/bookkeeping/categories', method: 'POST', data, unwrapResult: true }),
  updateCategory: (id, data) => request({ url: `/api/v1/app/bookkeeping/categories/${id}`, method: 'PATCH', data, unwrapResult: true }),
  deleteCategory: (id) => request({ url: `/api/v1/app/bookkeeping/categories/${id}`, method: 'DELETE', unwrapResult: true }),

  listTransactions: (range) => request({ url: '/api/v1/app/bookkeeping/transactions', data: range, unwrapResult: true }),
  getSummary: (range) => request({ url: '/api/v1/app/bookkeeping/transactions/summary', data: range, unwrapResult: true }),
  createTransaction: (data) => request({ url: '/api/v1/app/bookkeeping/transactions', method: 'POST', data, unwrapResult: true }),
  updateTransaction: (id, data) => request({ url: `/api/v1/app/bookkeeping/transactions/${id}`, method: 'PATCH', data, unwrapResult: true }),
  deleteTransaction: (id) => request({ url: `/api/v1/app/bookkeeping/transactions/${id}`, method: 'DELETE', unwrapResult: true }),

  chat: (data) => request({ url: '/api/v1/app/chat', method: 'POST', data }),
  streamChat: (data, onToken) => streamChat(data, onToken),
  chatHistory: (sessionId) => request({ url: '/api/v1/app/chat/history', data: { sessionId } }),
  uploadImage,
  listCommands: () => request({ url: '/api/v1/app/command/list' })
}
