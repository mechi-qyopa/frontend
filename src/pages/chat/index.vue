<template>
  <view class="chat-page">
    <scroll-view class="messages" scroll-y :scroll-into-view="bottomId">
      <view v-if="!messages.length" class="welcome"><text class="welcome-title">你好，我是记账助手</text><text>可以问我记账建议，或聊聊你的收支规划。</text></view>
      <view v-for="(item, index) in messages" :id="`message-${index}`" :key="`${item.id || index}-${item.createdAt || ''}`" :class="['message', item.role === 'USER' || item.role === 'user' ? 'user' : 'assistant']"><text>{{ item.content }}</text><text v-if="item.streaming" class="typing-cursor">▍</text></view>
      <view id="chat-bottom" />
    </scroll-view>
    <view class="composer"><input v-model="input" class="composer-input" confirm-type="send" placeholder="输入消息…" @confirm="send" /><button class="send" :loading="sending" @click="send">发送</button></view>
  </view>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { showRequestError } from '../../utils/request'

const SESSION_KEY = 'mechi_chat_session_id'
const messages = ref([])
const input = ref('')
const sending = ref(false)
const bottomId = ref('chat-bottom')
const sessionId = ref('')

onShow(loadHistory)
function ensureSession() { sessionId.value = uni.getStorageSync(SESSION_KEY) || `chat_${Date.now()}`; uni.setStorageSync(SESSION_KEY, sessionId.value) }
async function loadHistory() { ensureSession(); try { messages.value = await appApi.chatHistory(sessionId.value); scrollBottom() } catch (error) { showRequestError(error) } }
async function send() {
  const message = input.value.trim()
  if (!message || sending.value) return
  input.value = ''
  messages.value.push({ role: 'USER', content: message })
  const assistantMessage = { role: 'ASSISTANT', content: '', streaming: true }
  messages.value.push(assistantMessage)
  scrollBottom()
  sending.value = true
  try {
    await appApi.streamChat({ message, sessionId: sessionId.value }, (token) => {
      if (token.startsWith('[ERROR]')) throw new Error(token.replace(/^\[ERROR\]\s*/, ''))
      assistantMessage.content += token
      scrollBottom()
    })
  } catch (error) {
    if (!assistantMessage.content) messages.value.pop()
    showRequestError(error)
  } finally {
    assistantMessage.streaming = false
    sending.value = false
    scrollBottom()
  }
}
function scrollBottom() { nextTick(() => { bottomId.value = ''; setTimeout(() => { bottomId.value = 'chat-bottom' }, 20) }) }
</script>

<style scoped>
.chat-page { display: flex; flex-direction: column; height: calc(100vh - var(--window-top) - var(--window-bottom)); }.messages { flex: 1; min-height: 0; padding: 26rpx 24rpx; box-sizing: border-box; }.welcome { margin: 120rpx 20rpx; color: #667085; text-align: center; line-height: 1.8; }.welcome-title { display: block; margin-bottom: 14rpx; color: #344054; font-size: 36rpx; font-weight: 600; }.message { max-width: 80%; margin: 18rpx 0; padding: 20rpx 24rpx; border-radius: 22rpx; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }.user { margin-left: auto; border-bottom-right-radius: 6rpx; color: #fff; background: #1677ff; }.assistant { margin-right: auto; border-bottom-left-radius: 6rpx; background: #fff; box-shadow: 0 6rpx 20rpx rgba(29, 41, 57, .06); }.typing-cursor { display: inline-block; margin-left: 4rpx; color: #1677ff; animation: blink 1s step-end infinite; }.composer { display: flex; flex-shrink: 0; gap: 16rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: #fff; box-shadow: 0 -4rpx 18rpx rgba(29, 41, 57, .06); }.composer-input { flex: 1; height: 78rpx; padding: 0 22rpx; border-radius: 18rpx; background: #f2f4f7; }.send { width: 116rpx; height: 78rpx; color: #fff; line-height: 78rpx; background: #1677ff; font-size: 26rpx; }@keyframes blink { 50% { opacity: 0; } }
</style>
