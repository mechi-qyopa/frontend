<template>
  <view class="chat-page">
    <scroll-view class="messages" scroll-y :scroll-into-view="bottomId">
      <view v-if="!messages.length" class="welcome">
        <view class="welcome-avatar">AI</view>
        <text class="welcome-title">你好，我是记账助手</text>
        <text class="welcome-description">可以问我记账建议，或聊聊你的收支规划。</text>
      </view>

      <view v-for="(item, index) in messages" :id="`message-${index}`" :key="`${item.id || index}-${item.createdAt || ''}`" :class="['message-row', isUserMessage(item) ? 'user-row' : 'assistant-row']">
        <view v-if="!isUserMessage(item)" class="message-avatar assistant-avatar">AI</view>
        <view class="message-content">
          <view :class="['message', isUserMessage(item) ? 'user' : 'assistant']"><text>{{ item.content }}</text><text v-if="item.streaming" class="typing-cursor">▍</text></view>
        </view>
        <image v-if="isUserMessage(item) && userAvatar && !userAvatarFailed" class="message-avatar user-avatar-image" :src="userAvatar" mode="aspectFill" @error="userAvatarFailed = true" />
        <view v-else-if="isUserMessage(item)" class="message-avatar user-avatar">{{ userInitial }}</view>
      </view>
      <view id="chat-bottom" />
    </scroll-view>

    <view class="composer">
      <view class="composer-field">
        <input v-model="input" class="composer-input" maxlength="1000" confirm-type="send" placeholder="输入消息，向助手提问…" @confirm="send" />
        <text v-if="input.length" class="composer-count">{{ input.length }}/1000</text>
      </view>
      <button class="send" :class="{ 'send-ready': input.trim() && !sending }" :disabled="!input.trim() || sending" :loading="sending" @click="send">发送</button>
    </view>
  </view>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { showRequestError } from '../../utils/request'

const SESSION_KEY = 'mechi_chat_session_id'
const messages = ref([])
const input = ref('')
const sending = ref(false)
const bottomId = ref('chat-bottom')
const sessionId = ref('')
const userAvatarFailed = ref(false)
const userAvatar = computed(() => authStore.profile?.avatar || '')
const userInitial = computed(() => (authStore.profile?.username || '我').slice(0, 1).toUpperCase())

onShow(loadHistory)
function isUserMessage(item) { return item.role === 'USER' || item.role === 'user' }
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
.chat-page { display: flex; flex-direction: column; height: calc(100vh - var(--window-top) - var(--window-bottom)); background: #f5f7fb; }
.messages { flex: 1; min-height: 0; padding: 32rpx 24rpx 24rpx; box-sizing: border-box; }
.welcome { display: flex; flex-direction: column; align-items: center; margin: 116rpx 20rpx; color: #667085; text-align: center; line-height: 1.8; }
.welcome-avatar,.message-avatar { display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border-radius: 50%; font-weight: 700; }
.welcome-avatar { width: 104rpx; height: 104rpx; margin-bottom: 22rpx; color: #fff; background: linear-gradient(135deg, #1677ff, #76aeff); box-shadow: 0 10rpx 24rpx rgba(22, 119, 255, .2); font-size: 34rpx; }
.welcome-title { display: block; margin-bottom: 10rpx; color: #344054; font-size: 36rpx; font-weight: 600; }
.welcome-description { color: #667085; font-size: 27rpx; }
.message-row { display: flex; align-items: flex-start; gap: 14rpx; margin: 24rpx 0; }
.user-row { justify-content: flex-end; }
.assistant-row { justify-content: flex-start; }
.message-avatar { width: 64rpx; height: 64rpx; font-size: 24rpx; }
.assistant-avatar { color: #fff; background: linear-gradient(135deg, #1677ff, #76aeff); box-shadow: 0 5rpx 14rpx rgba(22, 119, 255, .18); }
.user-avatar { color: #1677ff; background: #dcecff; }
.user-avatar-image { display: block; background: #dcecff; }
.message-content { display: flex; flex-direction: column; max-width: calc(100% - 78rpx); }
.user-row .message-content { align-items: flex-end; }
.assistant-row .message-content { align-items: flex-start; }
.message-role { display: none; }
.message { max-width: 100%; padding: 20rpx 24rpx; border-radius: 22rpx; line-height: 1.6; white-space: pre-wrap; word-break: break-word; box-sizing: border-box; }
.user { color: #fff; background: linear-gradient(135deg, #1677ff, #3e91ff); box-shadow: 0 8rpx 18rpx rgba(22, 119, 255, .16); }
.assistant { color: #344054; background: #fff; border: 1rpx solid #edf0f5; box-shadow: 0 6rpx 20rpx rgba(29, 41, 57, .05); }
.typing-cursor { display: inline-block; margin-left: 4rpx; color: #1677ff; animation: blink 1s step-end infinite; }
.composer { display: flex; align-items: center; flex-shrink: 0; gap: 16rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #edf0f5; background: rgba(255, 255, 255, .97); box-shadow: 0 -6rpx 22rpx rgba(29, 41, 57, .05); }
.composer-field { display: flex; align-items: center; flex: 1; min-width: 0; height: 82rpx; padding: 0 20rpx 0 24rpx; border: 2rpx solid transparent; border-radius: 24rpx; background: #f2f4f7; box-sizing: border-box; transition: border-color .2s, background .2s; }
.composer-field:focus-within { border-color: #a9ceff; background: #fff; }
.composer-input { flex: 1; min-width: 0; height: 78rpx; color: #344054; font-size: 28rpx; }
.composer-count { flex-shrink: 0; margin-left: 10rpx; color: #98a2b3; font-size: 20rpx; }
.send { width: 116rpx; height: 82rpx; margin: 0; padding: 0; border-radius: 24rpx; color: #98a2b3; line-height: 82rpx; background: #e4e7ec; font-size: 26rpx; transition: transform .2s, background .2s; }
.send::after { border: 0; }
.send-ready { color: #fff; background: #1677ff; box-shadow: 0 8rpx 16rpx rgba(22, 119, 255, .2); }
.send-ready:active { transform: scale(.96); }
@keyframes blink { 50% { opacity: 0; } }
</style>