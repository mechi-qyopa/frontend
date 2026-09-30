<template>
  <!-- #ifndef MP-WEIXIN -->
  <image class="category-line-icon" :src="src" :style="{ width: size + 'rpx', height: size + 'rpx' }" mode="aspectFit" />
  <!-- #endif -->
  <!-- #ifdef MP-WEIXIN -->
  <text class="category-line-icon-emoji" :style="{ fontSize: size * 0.9 + 'rpx', lineHeight: 1 }">{{ emoji }}</text>
  <!-- #endif -->
</template>

<script setup>
import { computed } from 'vue'
import { themeStore } from '../stores/theme'
import { categoryIcon, categoryIconSrc } from '../utils/category-icon'

// 分类线条图标：默认用主题次级文字色，可通过 color 强调（如选中态用主色）
const props = defineProps({
  name: { type: String, default: '' },
  type: { type: String, default: 'EXPENSE' },
  size: { type: Number, default: 44 },
  color: { type: String, default: '' },
  iconKey: { type: String, default: '' }
})
const src = computed(() => categoryIconSrc(props.name, props.type, props.color || themeStore.currentTheme.colors.textSecondary, props.iconKey))
const emoji = computed(() => categoryIcon(props.name, props.type))
</script>

<style scoped>
.category-line-icon { display: block; }
</style>
