import { API_BASE_URL } from '../config'
import { authStore } from '../stores/auth'
import { redirectToLogin, refreshAccessToken, request } from '../utils/request'

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

// App 端逻辑层没有 fetch，用 uni.request enableChunked 接收 SSE 分块；ArrayBuffer 手动按 UTF-8 解码（处理跨块撕裂）
function createChunkDecoder() {
  let pending = new Uint8Array(0)
  const concat = (a, b) => { const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out }
  return (chunk) => {
    const incoming = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : new Uint8Array(chunk.buffer || chunk)
    const all = concat(pending, incoming)
    let end = all.length
    for (let i = all.length - 1; i >= 0 && i >= all.length - 4; i--) {
      if ((all[i] & 0xc0) !== 0x80) {
        const seqLen = all[i] < 0x80 ? 1 : all[i] < 0xe0 ? 2 : all[i] < 0xf0 ? 3 : 4
        if (i + seqLen > all.length) end = i
        break
      }
    }
    pending = all.slice(end)
    const bytes = all.slice(0, end)
    let out = ''
    for (let i = 0; i < bytes.length;) {
      const b = bytes[i]
      if (b < 0x80) { out += String.fromCharCode(b); i += 1 }
      else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2 }
      else if (b < 0xf0) { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3 }
      else { out += String.fromCodePoint(((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f)); i += 4 }
    }
    return out
  }
}

// App 端逻辑层没有 fetch：统一只调 /chat/stream，保证单次请求。
// 基座支持 onChunkReceived 时逐块流式；不支持时请求正常完成，在 success 里一次性解析完整 SSE。
function streamChatNative(data, onToken) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    let headerStatus = 0
    let chunked = false
    let settled = false
    const finish = (fn, value) => { if (!settled) { settled = true; fn(value) } }
    const failWith = (message) => finish(reject, new Error(message))
    const consumeAll = (text) => { buffer += text; buffer = consumeSseEvents(`${buffer}\n\n`, onToken); buffer = '' }
    const decode = createChunkDecoder()
    const task = uni.request({
      url: `${API_BASE_URL}/api/v1/app/chat/stream`,
      method: 'POST',
      enableChunked: true,
      dataType: 'text',
      timeout: 120000,
      header: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(authStore.token ? { 'X-App-Token': authStore.token } : {})
      },
      data,
      success: (res) => {
        if (res.statusCode === 401) { failWith('UNAUTHORIZED'); return }
        if (res.statusCode !== 200) { failWith(typeof res.data === 'string' && res.data ? res.data : `流式请求失败(${res.statusCode})`); return }
        if (!chunked && buffer.length === 0 && typeof res.data === 'string' && res.data) consumeAll(res.data)
        else if (buffer.trim()) consumeSseEvents(`${buffer}\n\n`, onToken)
        finish(resolve)
      },
      fail: (error) => failWith(headerStatus === 401 ? 'UNAUTHORIZED' : (error?.errMsg || '流式请求失败'))
    })
    if (typeof task?.onChunkReceived === 'function') {
      if (typeof task.onHeadersReceived === 'function') {
        task.onHeadersReceived(({ statusCode }) => {
          headerStatus = statusCode
          if (statusCode === 401) task.abort()
        })
      }
      task.onChunkReceived(({ data: chunk }) => {
        if (headerStatus && headerStatus !== 200) return
        chunked = true
        buffer += decode(chunk)
        buffer = consumeSseEvents(buffer, onToken)
      })
    }
    // 分块 API 不可用时不中止请求：等待 success，用完整响应一次性解析，仍只有一次调用
  })
}

async function streamChat(data, onToken, retried = false) {
  if (typeof fetch !== 'function') {
    try {
      await streamChatNative(data, onToken)
    } catch (error) {
      if (error?.message === 'UNAUTHORIZED' && !retried) {
        try {
          await refreshAccessToken()
          return streamChat(data, onToken, true)
        } catch (refreshError) {
          redirectToLogin()
          throw refreshError
        }
      }
      throw error
    }
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
  if (response.status === 401 && !retried) {
    try {
      await refreshAccessToken()
      return streamChat(data, onToken, true)
    } catch (error) {
      redirectToLogin()
      throw error
    }
  }
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

function uploadImage(filePath, retried = false) {
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
        if (statusCode === 401 && !retried) {
          refreshAccessToken()
            .then(() => uploadImage(filePath, true))
            .then(resolve)
            .catch((error) => {
              redirectToLogin()
              reject(error)
            })
          return
        }
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
  login: (data) => request({ url: '/api/v1/app/login', method: 'POST', data, retryOnUnauthorized: false }),
  logout: () => request({ url: '/api/v1/app/logout', method: 'POST' }),
  getMe: () => request({ url: '/api/v1/app/me' }),
  updateMe: (data) => request({ url: '/api/v1/app/me', method: 'PATCH', data }),

  listCategories: () => request({ url: '/api/v1/app/bookkeeping/categories', unwrapResult: true }),
  createCategory: (data) => request({ url: '/api/v1/app/bookkeeping/categories', method: 'POST', data, unwrapResult: true }),
  updateCategory: (id, data) => request({ url: `/api/v1/app/bookkeeping/categories/${id}`, method: 'PATCH', data, unwrapResult: true }),
  deleteCategory: (id) => request({ url: `/api/v1/app/bookkeeping/categories/${id}`, method: 'DELETE', unwrapResult: true }),

  listTransactions: (range) => request({ url: '/api/v1/app/bookkeeping/transactions', data: range, unwrapResult: true }),
  getTransaction: (id) => request({ url: `/api/v1/app/bookkeeping/transactions/${id}`, unwrapResult: true }),
  getSummary: (range) => request({ url: '/api/v1/app/bookkeeping/transactions/summary', data: range, unwrapResult: true }),
  getTransactionActivityStats: () => request({ url: '/api/v1/app/bookkeeping/transactions/activity-stats', unwrapResult: true }),
  createTransaction: (data) => request({ url: '/api/v1/app/bookkeeping/transactions', method: 'POST', data, unwrapResult: true }),
  updateTransaction: (id, data) => request({ url: `/api/v1/app/bookkeeping/transactions/${id}`, method: 'PATCH', data, unwrapResult: true }),
  deleteTransaction: (id) => request({ url: `/api/v1/app/bookkeeping/transactions/${id}`, method: 'DELETE', unwrapResult: true }),

  chat: (data) => request({ url: '/api/v1/app/chat', method: 'POST', data }),
  streamChat: (data, onToken) => streamChat(data, onToken),
  listChatConversations: () => request({ url: '/api/v1/app/chat/conversations' }),
  chatHistory: (sessionId) => request({ url: '/api/v1/app/chat/history', data: { sessionId} }),
  uploadImage,
  listCommands: () => request({ url: '/api/v1/app/command/list' })
}
