<template>
  <view class="sse-bridge" :request="request" :change:request="sseBridge.onRequest"></view>
</template>

<script>
// 选项式 API：renderjs 的 ownerInstance.callMethod 仅支持调用选项式 methods 中的方法。
// 子组件只负责 fetch SSE 并回传事件，由父组件接收事件后驱动 UI 状态。
export default {
  props: {
    request: { type: String, default: '' }
  },
  emits: ['token', 'done', 'error'],
  methods: {
    onStreamToken(token) { if (token) this.$emit('token', token) },
    onStreamDone() { this.$emit('done') },
    onStreamError(message) { this.$emit('error', message) }
  }
}
</script>

<script module="sseBridge" lang="renderjs">
export default {
  data() {
    return { lastId: 0, controller: null, aborting: false }
  },
  methods: {
    onRequest(newVal, oldVal, ownerInstance) {
      if (!newVal) return
      let request
      try { request = JSON.parse(newVal) } catch (error) { return }
      if (!request || !request.id || request.id === this.lastId) return
      this.lastId = request.id
      // 负数 id 视为 abort 指令：页面卸载/切走时终止进行中的 fetch，避免空转耗电
      if (request.abort) {
        if (this.controller) {
          this.aborting = true
          this.controller.abort()
        }
        return
      }
      this.run(request, ownerInstance)
    },
    // 非 JSON 响应（如网关 502 HTML）不能整段透传到 toast，截断并优先取后端 message 字段
    humanizeError(text, status) {
      const raw = (text || '').trim()
      if (!raw) return `流式请求失败(${status})`
      try {
        const data = JSON.parse(raw)
        const message = data?.message || data?.error || data?.msg
        if (message) return String(message)
      } catch (error) { /* 非 JSON 响应，按原文截断 */ }
      return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw
    },
    async run(request, ownerInstance) {
      if (this.controller) this.controller.abort()
      const controller = new AbortController()
      this.controller = controller
      this.aborting = false
      // 空闲超时：每次收到新数据就重置计时，避免长回复（>2 分钟）被总时长上限误杀
      let idleTimer = setTimeout(() => controller.abort(), 120000)
      const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => controller.abort(), 120000) }
      try {
        const response = await fetch(request.url, {
          method: 'POST',
          headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
            ...(request.token ? { 'X-App-Token': request.token } : {})
          },
          body: JSON.stringify(request.body),
          signal: controller.signal
        })
        if (response.status === 401) {
          clearTimeout(idleTimer)
          ownerInstance.callMethod('onStreamError', 'UNAUTHORIZED')
          return
        }
        if (!response.ok || !response.body) {
          const text = response.body ? await response.text() : ''
          clearTimeout(idleTimer)
          ownerInstance.callMethod('onStreamError', this.humanizeError(text, response.status))
          return
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          resetIdle()
          buffer += decoder.decode(value, { stream: true })
          buffer = this.consume(buffer, ownerInstance)
        }
        buffer += decoder.decode()
        if (buffer.trim()) this.consume(`${buffer}\n\n`, ownerInstance)
        clearTimeout(idleTimer)
        ownerInstance.callMethod('onStreamDone')
      } catch (error) {
        clearTimeout(idleTimer)
        if (this.aborting) { this.aborting = false; return }
        if (error?.name === 'AbortError') ownerInstance.callMethod('onStreamError', '回复超时，请重试')
        else ownerInstance.callMethod('onStreamError', error?.message || '对话请求失败')
      }
    },
    consume(buffer, ownerInstance) {
      const events = buffer.split(/\r?\n\r?\n/)
      const remainder = events.pop()
      events.forEach((event) => {
        const token = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n')
        if (!token) return
        if (token.startsWith('[ERROR]')) ownerInstance.callMethod('onStreamError', token.replace(/^\[ERROR\]\s*/, ''))
        else ownerInstance.callMethod('onStreamToken', token.replace(/\\n/g, '\n'))
      })
      return remainder
    }
  }
}
</script>

<style scoped>
.sse-bridge { position: absolute; top: -10rpx; left: -10rpx; width: 0; height: 0; overflow: hidden; }
</style>
