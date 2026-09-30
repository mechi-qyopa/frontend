<template>
  <view :class="['chat-page', `theme-${themeStore.id}`]" :key="themeStore.id" :style="[themeStore.pageStyle, appChatStyle]">
    <view class="chat-header">
      <view class="conversation-trigger">
        <text class="conversation-label">当前对话</text>
        <text class="conversation-title">{{ activeConversationTitle }}</text>
      </view>
      <view class="header-actions">
        <button class="icon-trigger" :disabled="sending" aria-label="新对话" @click="newConversation"><view class="chat-plus-icon" /></button>
        <button class="icon-trigger" :disabled="sending" aria-label="历史对话" @click="openConversationList"><view class="history-lines"><view /><view /><view /></view></button>
      </view>
    </view>

    <scroll-view class="messages" scroll-y :scroll-into-view="bottomId" @scroll="onMessagesScroll">
      <view v-if="historyLoading" class="history-loading"><text>加载中…</text></view>
      <view v-else-if="!messages.length" class="welcome">
        <view class="welcome-avatar"><image v-if="themeStore.currentTheme.mascot" class="avatar-mascot" :src="themeStore.currentTheme.mascot" mode="aspectFit" /><text v-else>AI</text></view>
        <text class="welcome-title">{{ mascots ? '你好，我是喵记账助手' : '你好，我是记账助手' }}</text>
        <text class="welcome-description">{{ mascots ? '可以问我记账建议，或聊聊你的收支规划喵～' : '可以问我记账建议，或聊聊你的收支规划。' }}</text>
        <view v-if="mascots" class="welcome-paws"><image :src="mascots.strawberry" mode="aspectFit" /><image :src="mascots.rice" mode="aspectFit" /><image :src="mascots.peach" mode="aspectFit" /></view>
      </view>

      <view v-for="(item, index) in messages" :id="`message-${index}`" :key="`${item.id || index}-${item.createdAt || ''}`" :class="['message-row', isUserMessage(item) ? 'user-row' : 'assistant-row']">
        <view v-if="!isUserMessage(item)" class="message-avatar assistant-avatar"><image v-if="mascots || themeStore.currentTheme.mascot" class="avatar-mascot" :src="mascots?.chat || themeStore.currentTheme.mascot" mode="aspectFit" /><text v-else>AI</text></view>
        <view class="message-content">
          <view :class="['message', isUserMessage(item) ? 'user' : 'assistant']"><text>{{ item.content }}</text><text v-if="item.streaming" class="typing-cursor">▍</text></view>
        </view>
        <image v-if="isUserMessage(item) && userAvatar && !userAvatarFailed" class="message-avatar user-avatar-image" :src="userAvatar" mode="aspectFill" @error="userAvatarFailed = true" />
        <view v-else-if="isUserMessage(item)" class="message-avatar user-avatar">{{ userInitial }}</view>
      </view>
      <view id="chat-bottom" />
    </scroll-view>

    <view v-if="inputFocused && keyboardHeight > 0" class="keyboard-mask" @touchmove.stop.prevent @click="dismissKeyboard" />
    <view :class="['composer', { floating: inputFocused && keyboardHeight > 0 }]" :style="{ bottom: keyboardHeight && inputFocused ? keyboardHeight + 8 + 'px' : undefined }">
      <view class="composer-field">
        <input v-model="input" class="composer-input" maxlength="1000" confirm-type="send" :placeholder="mascots ? '向喵助手提问…' : '输入消息，向助手提问…'" :adjust-position="false" @focus="onInputFocus" @blur="onInputBlur" @confirm="send" />
        <text v-if="input.length" class="composer-count">{{ input.length }}/1000</text>
      </view>
      <button class="send" :class="{ 'send-ready': input.trim() && !sending }" :disabled="!input.trim() || sending" :loading="sending" @click="send">{{ mascots ? '发送喵' : '发送' }}</button>
    </view>

    <view v-if="conversationListVisible" class="conversation-mask" @click="closeConversationList">
      <view class="conversation-panel" @click.stop>
        <view class="conversation-panel-header">
          <text class="conversation-panel-title">历史对话</text>
          <view class="conversation-close" role="button" aria-label="关闭历史对话" @click="closeConversationList"><u-icon name="close" size="14" /></view>
        </view>
        <button class="conversation-create" :disabled="sending" @click="newConversation">开启新对话</button>
        <scroll-view class="conversation-list" scroll-y>
          <view v-if="!conversations.length" class="conversation-empty">{{ mascots ? '还没有历史对话，先和喵助手聊两句吧～' : '还没有历史对话，发送第一条消息后会显示在这里。' }}</view>
          <view v-for="conversation in conversations" :key="conversation.sessionId" :class="['conversation-item', { active: conversation.sessionId === sessionId }]" @click="selectConversation(conversation.sessionId)">
            <view class="conversation-item-main">
              <text class="conversation-item-title">{{ conversation.title }}</text>
              <text class="conversation-item-time">{{ formatConversationTime(conversation.updatedAt) }}</text>
            </view>
            <text v-if="conversation.sessionId === sessionId" class="conversation-active-mark">当前</text>
            <view class="conversation-delete" role="button" :aria-label="`删除对话 ${conversation.title}`" @click.stop="removeConversation(conversation)"><u-icon name="trash" size="14" /></view>
          </view>
        </scroll-view>
      </view>
    </view>

    <custom-tab-bar />
    <!-- #ifdef APP-PLUS -->
    <!-- App 端流式桥：renderjs 必须运行在选项式 API 的子组件内（uni-app Vue3 不支持 <script setup> 与 renderjs 的 callMethod 配合） -->
    <sse-bridge :request="sseRequestJson" @token="onStreamToken" @done="onStreamDone" @error="onStreamError" />
    <!-- #endif -->
  </view>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { appApi } from '../../api/app'
import { authStore } from '../../stores/auth'
import { themeStore } from '../../stores/theme'
import { showRequestError } from '../../utils/request'
import CustomTabBar from '../../custom-tab-bar/index.vue'
// #ifdef APP-PLUS
import SseBridge from '../../sse-bridge/index.vue'
import { API_BASE_URL } from '../../config'
import { redirectToLogin, refreshAccessToken } from '../../utils/request'
// #endif

const SESSION_KEY = 'mechi_chat_session_id'
const messages = ref([])
const input = ref('')
const sending = ref(false)
const bottomId = ref('chat-bottom')
const sessionId = ref('')
const conversations = ref([])
const conversationListVisible = ref(false)
const userAvatarFailed = ref(false)
const inputFocused = ref(false)
const keyboardHeight = ref(0)
const historyLoading = ref(true)
const autoFollow = ref(true)
const messagesViewport = ref(0)
let keyboardHandler = null
const userAvatar = computed(() => authStore.profile?.avatar || '')
// 猫咪主题：mascots 存在即进入猫咪模式（喵化文案 + 专属猫咪头像）
const mascots = computed(() => themeStore.currentTheme.mascots || null)
const userInitial = computed(() => (authStore.profile?.username || '我').slice(0, 1).toUpperCase())
const activeConversationTitle = computed(() => {
  return conversations.value.find((conversation) => conversation.sessionId === sessionId.value)?.title || '新对话'
})

// #ifdef APP-PLUS
// App 端页面高度 = 视口高 - tabBar 实测渲染高 + 4px 保险（超出部分被不透明 tabBar 盖住，杜绝取整误差露出白缝）。
const { windowWidth, windowHeight, safeAreaInsets } = uni.getSystemInfoSync()
const fallbackTabBarPx = Math.round((140 * windowWidth) / 750) + (safeAreaInsets?.bottom || 0)
const appChatStyle = computed(() => {
  if (inputFocused.value && keyboardHeight.value > 0) {
    // 键盘弹起：页面底边收缩到键盘上沿；输入栏悬浮于消息之上，最新消息由滚动内容末尾的 #chat-bottom 锚点让位
    return { height: `${Math.max(windowHeight - keyboardHeight.value, 0)}px` }
  }
  const tabBarPx = themeStore.appTabBar.heightPx || fallbackTabBarPx
  return { height: `${Math.max(windowHeight - tabBarPx + 4, 0)}px` }
})
// #endif

onShow(async () => {
  // 页面重新可见时键盘必然已收起；重置悬浮状态，防止 keyboardHeight 残留导致输入框悬空
  keyboardHeight.value = 0
  inputFocused.value = false
  ensureSession()
  await Promise.all([loadConversations(), loadHistory()])
})
// uni.onKeyboardHeightChange 无返回值，必须保存 handler 引用并在 onUnload 中显式 off，否则重复进入页面会叠加监听
if (typeof uni.onKeyboardHeightChange === 'function') {
  keyboardHandler = ({ height }) => {
    keyboardHeight.value = height
    if (height > 0) { if (inputFocused.value) scrollBottom() } else inputFocused.value = false
    nextTick(measureMessagesViewport)
  }
  uni.onKeyboardHeightChange(keyboardHandler)
}
onUnload(() => {
  if (keyboardHandler && typeof uni.offKeyboardHeightChange === 'function') uni.offKeyboardHeightChange(keyboardHandler)
  // #ifdef APP-PLUS
  abortAppStream()
  // #endif
})
// 用户上翻阅读历史时暂停自动滚底，重新接近底部后恢复跟随
function onMessagesScroll(e) {
  if (!messagesViewport.value) return
  autoFollow.value = e.detail.scrollHeight - e.detail.scrollTop - messagesViewport.value < 120
}
function measureMessagesViewport() {
  uni.createSelectorQuery().select('.messages').boundingClientRect((rect) => { if (rect?.height) messagesViewport.value = rect.height }).exec()
}
function followStream() { if (autoFollow.value) scrollBottom() }
function onInputFocus() { inputFocused.value = true; scrollBottom() }
function onInputBlur() { inputFocused.value = false }
function dismissKeyboard() { if (typeof uni.hideKeyboard === 'function') uni.hideKeyboard() }

function isUserMessage(item) { return item.role === 'USER' || item.role === 'user' }
function createSessionId() { return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` }
function ensureSession() {
  sessionId.value = uni.getStorageSync(SESSION_KEY) || createSessionId()
  uni.setStorageSync(SESSION_KEY, sessionId.value)
}
async function loadConversations(showError = true) {
  try {
    conversations.value = await appApi.listChatConversations()
  } catch (error) {
    if (showError) showRequestError(error)
  }
}
async function loadHistory() {
  historyLoading.value = true
  try {
    messages.value = await appApi.chatHistory(sessionId.value)
    scrollBottom()
  } catch (error) {
    showRequestError(error)
  } finally {
    historyLoading.value = false
  }
}
async function openConversationList() {
  if (sending.value) return
  conversationListVisible.value = true
  await loadConversations()
}
function closeConversationList() { conversationListVisible.value = false }
function newConversation() {
  if (sending.value) return
  sessionId.value = createSessionId()
  uni.setStorageSync(SESSION_KEY, sessionId.value)
  messages.value = []
  input.value = ''
  conversationListVisible.value = false
  scrollBottom()
}
async function selectConversation(selectedSessionId) {
  if (sending.value || selectedSessionId === sessionId.value) {
    conversationListVisible.value = false
    return
  }
  sessionId.value = selectedSessionId
  uni.setStorageSync(SESSION_KEY, selectedSessionId)
  messages.value = []
  conversationListVisible.value = false
  await loadHistory()
}
function removeConversation(conversation) {
  uni.showModal({
    title: '删除对话',
    content: `删除“${conversation.title}”后聊天记录无法恢复，确定删除吗？`,
    confirmColor: '#ef4444',
    success: async ({ confirm }) => {
      if (!confirm) return
      try {
        await appApi.deleteChatConversation(conversation.sessionId)
        conversations.value = conversations.value.filter((item) => item.sessionId !== conversation.sessionId)
        if (conversation.sessionId === sessionId.value) {
          // 删除的是当前对话：重置到新会话（抽屉保持打开，可直接继续选）
          sessionId.value = createSessionId()
          uni.setStorageSync(SESSION_KEY, sessionId.value)
          messages.value = []
        }
        uni.showToast({ title: '已删除', icon: 'success' })
      } catch (error) {
        showRequestError(error)
      }
    }
  })
}
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
    // #ifdef APP-PLUS
    await sendViaAppStream(message, assistantMessage)
    // #endif
    // #ifndef APP-PLUS
    await appApi.streamChat({ message, sessionId: sessionId.value }, (token) => {
      if (token.startsWith('[ERROR]')) throw new Error(token.replace(/^\[ERROR\]\s*/, ''))
      assistantMessage.content += token
      followStream()
    })
    // #endif
  } catch (error) {
    if (!assistantMessage.content) messages.value.pop()
    if (error?.message !== 'ABORTED') showRequestError(error)
  } finally {
    assistantMessage.streaming = false
    sending.value = false
    await loadConversations(false)
    scrollBottom()
  }
}
function formatConversationTime(value) {
  return value ? value.replace('T', ' ').slice(0, 16) : ''
}
function scrollBottom() { nextTick(() => { bottomId.value = ''; setTimeout(() => { bottomId.value = 'chat-bottom' }, 20) }) }

// #ifdef APP-PLUS
// renderjs 流式桥：逻辑层下发请求参数 → webview 里 fetch SSE → token 逐个回传
const sseRequestJson = ref('')
let sseSequence = 0
let activeSse = null

function sendViaAppStream(message, assistantMessage, retried = false) {
  return new Promise((resolve, reject) => {
    activeSse = { assistantMessage, resolve, reject, finished: false }
    sseSequence += 1
    sseRequestJson.value = JSON.stringify({
      id: sseSequence,
      url: `${API_BASE_URL}/api/v1/app/chat/stream`,
      token: authStore.token || '',
      body: { message, sessionId: sessionId.value }
    })
  }).catch(async (error) => {
    if (error?.message === 'UNAUTHORIZED' && !retried) {
      try {
        await refreshAccessToken()
      } catch (refreshError) {
        redirectToLogin()
        throw error
      }
      return sendViaAppStream(message, assistantMessage, true)
    }
    throw error
  })
}
function onStreamToken(token) {
  const active = activeSse
  if (!active || active.finished || !token) return
  active.assistantMessage.content += token
  followStream()
}
function onStreamDone() {
  const active = activeSse
  if (!active || active.finished) return
  active.finished = true
  active.resolve()
}
function onStreamError(message) {
  const active = activeSse
  if (!active || active.finished) return
  active.finished = true
  active.reject(new Error(message || '对话请求失败'))
}
// 页面卸载时终止进行中的流：通过负数 id 下发 abort 指令（正数 id 保留给真实请求），webview 内 fetch 循环随即中止
function abortAppStream() {
  if (!activeSse || activeSse.finished) return
  activeSse.finished = true
  activeSse.reject(new Error('ABORTED'))
  sseSequence += 1
  sseRequestJson.value = JSON.stringify({ id: -sseSequence, abort: true })
}
// #endif
</script>

<style scoped>
.chat-page { position: relative; display: flex; flex-direction: column; height: calc(100vh - var(--window-top) - var(--tab-bar-height, var(--window-bottom))); background: var(--theme-page-bg); box-sizing: border-box; }
/* #ifdef APP-PLUS */
/* App 端页面高度由 script 内按系统信息以像素内联（appChatStyle），精确等于视口高 - tabBar(140rpx) - 底部安全区 */
/* #endif */
.chat-header { display: flex; align-items: center; flex-shrink: 0; gap: 20rpx; padding: calc(18rpx + var(--status-bar-height, 0px)) 24rpx 18rpx; border-bottom: 1rpx solid var(--theme-border); background: var(--theme-surface); }
.conversation-trigger { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.conversation-label { color: var(--theme-text-muted); font-size: 21rpx; }
.conversation-title { overflow: hidden; margin-top: 2rpx; color: var(--theme-text-strong); font-size: var(--font-md); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.header-actions { display: flex; flex-shrink: 0; align-items: center; gap: 12rpx; }
/* 顶栏图标按钮：聊天气泡+号（新对话）/ 倒阶梯三线（历史对话）。纯 CSS 绘制：App webview 内 u-icon 字形在按钮内受 line-height 影响易变形 */
.icon-trigger { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 62rpx; height: 62rpx; margin: 0; padding: 0; border: 1rpx solid transparent; border-radius: var(--theme-radius-control, 16rpx); background: var(--theme-primary-soft); }
.icon-trigger::after { border: 0; }
.chat-plus-icon { position: relative; width: 32rpx; height: 28rpx; border: 3rpx solid var(--theme-primary); border-radius: 10rpx 10rpx 10rpx 3rpx; box-sizing: border-box; }
.chat-plus-icon::before { position: absolute; top: 50%; left: 50%; width: 13rpx; height: 3rpx; margin: -1.5rpx 0 0 -6.5rpx; border-radius: 3rpx; background: var(--theme-primary); content: ''; }
.chat-plus-icon::after { position: absolute; top: 50%; left: 50%; width: 3rpx; height: 13rpx; margin: -6.5rpx 0 0 -1.5rpx; border-radius: 3rpx; background: var(--theme-primary); content: ''; }
.history-lines { display: flex; width: 32rpx; height: 24rpx; flex-direction: column; align-items: flex-start; justify-content: space-between; }
.history-lines view { width: 32rpx; height: 4rpx; border-radius: 4rpx; background: var(--theme-primary); }
.history-lines view:nth-child(2) { width: 22rpx; }
.history-lines view:last-child { width: 12rpx; }
.messages { flex: 1; min-height: 0; padding: 32rpx 24rpx 24rpx; box-sizing: border-box; }
/* 滚动内容底部透明占位：滚到底时最后一条消息停在输入栏上方；上翻历史时消息从输入栏下方穿过，仅输入栏盖在记录上 */
#chat-bottom { display: block; height: calc(96rpx + env(safe-area-inset-bottom, 0px)); }
.history-loading { padding: 80rpx 0; color: var(--theme-text-muted); text-align: center; font-size: var(--font-body); }
.welcome { display: flex; flex-direction: column; align-items: center; margin: 116rpx 20rpx; color: var(--theme-text-secondary); text-align: center; line-height: 1.8; }
.welcome-avatar,.message-avatar { display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border-radius: 50%; font-weight: 700; }
.avatar-mascot { width: 100%; height: 100%; border-radius: 50%; background: var(--theme-surface); }
/* 猫咪主题：欢迎区爪印装饰 */
.welcome-paws { display: flex; align-items: center; justify-content: center; gap: 26rpx; margin-top: 26rpx; }
.welcome-paws image { width: 34rpx; height: 34rpx; opacity: .7; transform: rotate(16deg); }
.welcome-paws image:nth-child(2) { width: 44rpx; height: 44rpx; opacity: .95; transform: rotate(-14deg); }
.welcome-paws image:last-child { transform: rotate(-24deg); }
.welcome-avatar { width: 104rpx; height: 104rpx; margin-bottom: 22rpx; color: var(--theme-on-primary); background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); box-shadow: 0 10rpx 24rpx var(--theme-primary-shadow); font-size: 34rpx; }
.welcome-title { display: block; margin-bottom: 10rpx; color: var(--theme-text-strong); font-size: var(--font-title); font-weight: 600; }
.welcome-description { color: var(--theme-text-secondary); font-size: var(--font-body); }
.message-row { display: flex; align-items: flex-start; gap: 14rpx; margin: 24rpx 0; }
.user-row { justify-content: flex-end; }
.assistant-row { justify-content: flex-start; }
.message-avatar { width: 64rpx; height: 64rpx; font-size: 24rpx; }
.assistant-avatar { color: var(--theme-on-primary); background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); box-shadow: 0 5rpx 14rpx var(--theme-primary-shadow); }
.user-avatar { color: var(--theme-primary); background: var(--theme-primary-soft); }
.user-avatar-image { display: block; background: var(--theme-primary-soft); }
.message-content { display: flex; flex-direction: column; max-width: calc(100% - 78rpx); }
.user-row .message-content { align-items: flex-end; }
.assistant-row .message-content { align-items: flex-start; }
.message { max-width: 100%; padding: 20rpx 24rpx; border-radius: var(--theme-radius-control, 22rpx); line-height: 1.6; white-space: pre-wrap; word-break: break-word; box-sizing: border-box; }
.user { color: var(--theme-on-primary); background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); box-shadow: 0 8rpx 18rpx var(--theme-primary-shadow); }
.assistant { color: var(--theme-text-strong); background: var(--theme-surface); border: 1rpx solid var(--theme-border); box-shadow: var(--elev-1); }
.typing-cursor { display: inline-block; margin-left: 4rpx; color: var(--theme-primary); animation: blink 1s step-end infinite; }
/* 悬浮胶囊输入栏：窄身设计，少占聊天区空间 */
.composer { position: fixed; right: 24rpx; bottom: calc(var(--tab-bar-height, var(--window-bottom)) + env(safe-area-inset-bottom, 0px) + 16rpx); left: 24rpx; z-index: 20; display: flex; align-items: center; flex-shrink: 0; gap: 12rpx; padding: 10rpx 10rpx 10rpx 24rpx; border: 1rpx solid var(--theme-border); border-radius: 999rpx; background: var(--theme-surface); box-shadow: var(--elev-3); box-sizing: border-box; transition: border-color .2s ease; }
.composer:focus-within { border-color: var(--theme-primary); }
.keyboard-mask { position: fixed; z-index: 19; top: 0; right: 0; bottom: 0; left: 0; }
.composer-field { display: flex; align-items: center; flex: 1; min-width: 0; height: 64rpx; }
.composer-input { flex: 1; min-width: 0; height: 60rpx; color: var(--theme-text-strong); font-size: var(--font-body); }
.composer-count { flex-shrink: 0; margin-left: 10rpx; color: var(--theme-text-muted); font-size: 20rpx; }
.send { width: 88rpx; height: 64rpx; margin: 0; padding: 0; border-radius: 999rpx; color: var(--theme-text-muted); line-height: 64rpx; background: var(--theme-page-bg); font-size: var(--font-caption); transition: transform .2s ease, background-color .2s ease; }
.send::after { border: 0; }
.send-ready { color: var(--theme-on-primary); background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); box-shadow: 0 6rpx 16rpx var(--theme-primary-shadow); }
.send-ready:active { transform: scale(.96); }
/* 历史对话：左侧抽屉，右侧露出聊天界面，点击遮罩即返回 */
.conversation-mask { position: fixed; z-index: 110; top: 0; right: 0; bottom: 0; left: 0; background: rgba(15, 23, 42, .45); animation: mask-fade .2s ease; }
.conversation-panel { position: absolute; top: 0; bottom: 0; left: 0; display: flex; width: 600rpx; max-width: 82%; flex-direction: column; border-radius: 0 32rpx 32rpx 0; background: var(--theme-surface); box-shadow: var(--elev-3); animation: drawer-in .24s ease; }
.conversation-panel-header { display: flex; align-items: center; justify-content: space-between; padding: calc(var(--status-bar-height, 0px) + env(safe-area-inset-top, 0px) + 28rpx) 28rpx 22rpx; }
.conversation-panel-title { color: var(--theme-text); font-size: var(--font-title); font-weight: 700; }
.conversation-close { display: flex; align-items: center; justify-content: center; width: 56rpx; height: 56rpx; border-radius: 50%; color: var(--theme-text-secondary); background: var(--theme-page-bg); }
.conversation-create { height: 72rpx; margin: 0 24rpx 16rpx; border: 0; border-radius: 999rpx; color: var(--theme-on-primary); line-height: 72rpx; background: linear-gradient(150deg, var(--theme-primary), var(--theme-primary-end)); font-size: var(--font-body); }
.conversation-create:active { opacity: .85; }
.conversation-list { flex: 1; min-height: 0; padding: 0 16rpx 24rpx; overscroll-behavior: contain; box-sizing: border-box; }
.conversation-empty { padding: 56rpx 20rpx; color: var(--theme-text-muted); text-align: center; font-size: var(--font-body); line-height: 1.6; }
.conversation-item { display: flex; align-items: center; gap: 18rpx; min-height: 100rpx; margin-bottom: 6rpx; padding: 18rpx 20rpx; border-radius: 20rpx; box-sizing: border-box; }
.conversation-item:active { background: var(--theme-page-bg); }
.conversation-item.active { background: var(--theme-primary-soft); }
.conversation-item-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 8rpx; }
.conversation-item-title { overflow: hidden; color: var(--theme-text-strong); font-size: var(--font-body); text-overflow: ellipsis; white-space: nowrap; }
.conversation-item-time { color: var(--theme-text-muted); font-size: var(--font-caption); }
.conversation-active-mark { flex-shrink: 0; padding: 5rpx 14rpx; border-radius: 999rpx; color: var(--theme-primary); background: var(--theme-surface); font-size: 20rpx; }
.conversation-delete { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 56rpx; height: 56rpx; border-radius: 999rpx; color: var(--theme-text-muted); transition: background .15s ease, color .15s ease, transform .15s ease; }
.conversation-delete:active { transform: scale(.88); color: #ef4444; background: rgba(239, 68, 68, .1); }
@keyframes blink { 50% { opacity: 0; } }
@keyframes mask-fade { from { opacity: 0; } }
@keyframes drawer-in { from { transform: translateX(-30%); opacity: .4; } }

/* 按压态 */
.conversation-item:active, .icon-trigger:active { opacity: .76; }
</style>
