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
    return { lastId: 0, controller: null }
  },
  methods: {
    onRequest(newVal, oldVal, ownerInstance) {
      if (!newVal) return
      let request
      try { request = JSON.parse(newVal) } catch (error) { return }
      if (!request || !request.id || request.id === this.lastId) return
      this.lastId = request.id
      this.run(request, ownerInstance)
    },
    async run(request, ownerInstance) {
      if (this.controller) this.controller.abort()
      const controller = new AbortController()
      this.controller = controller
      const timeout = setTimeout(() => controller.abort(), 120000)
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
          clearTimeout(timeout)
          ownerInstance.callMethod('onStreamError', 'UNAUTHORIZED')
          return
        }
        if (!response.ok || !response.body) {
          const text = response.body ? await response.text() : ''
          clearTimeout(timeout)
          ownerInstance.callMethod('onStreamError', text || `流式请求失败(${response.status})`)
          return
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          buffer = this.consume(buffer, ownerInstance)
        }
        buffer += decoder.decode()
        if (buffer.trim()) this.consume(`${buffer}\n\n`, ownerInstance)
        clearTimeout(timeout)
        ownerInstance.callMethod('onStreamDone')
      } catch (error) {
        clearTimeout(timeout)
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
