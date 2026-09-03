// 分类简笔画 emoji 映射。按分类名精确匹配，未命中时返回按收支区分的通用兜底。
const EXPENSE_ICONS = {
  餐饮: '🍱', 外卖: '🥡', 吃饭: '🍜', 食堂: '🍽️', 饮料: '🧋', 饮品: '🧋', 咖啡: '☕', 零食: '🧁', 水果: '🍎',
  购物: '🛍️', 日用: '🧻', 交通: '🚌', 打车: '🚕', 加油: '⛽', 停车: '🅿️',
  蔬菜: '🥬', 买菜: '🥕', 服饰: '👕', 衣服: '👔', 美容: '💄', 化妆: '💋', 护肤: '🧴',
  运动: '🛼', 健身: '🏋️', 娱乐: '🎮', 游戏: '🕹️', 电影: '🎬', 旅行: '✈️', 旅游: '🧳', 酒店: '🏨',
  通讯: '📞', 话费: '📱', 流量: '📶', 水电: '💡', 物业: '🏠', 房租: '🏢', 网费: '🌐', 居住: '🏠', 家居: '🛋️',
  宠物: '🐶', 看病: '🏥', 医疗: '💊', 学习: '📚', 教育: '🎓', 书报: '📖',
  亲子: '🧒', 玩具: '🧸', 红包: '🧧', 礼金: '🧧', 礼物: '🎁', 社交: '🎉', 请客: '🥂',
  烟酒: '🍷', 茶: '🍵', 保健: '🩺', 出行: '🚗', 其他: '📦'
}

const INCOME_ICONS = {
  工资: '💰', 奖金: '🎁', 提成: '📊', 分红: '💸',
  理财: '📈', 投资: '📉', 股票: '📈', 基金: '💹', 利息: '🏦', 存款: '🏧',
  退款: '↩️', 报销: '🧾', 兼职: '👷', 副业: '💼', 跑腿: '🏃',
  红包收: '🧧', 转账: '💳', 其他: '💵'
}

/**
 * 按分类名查简笔画 emoji。未命中时返回按收支区分的通用兜底。
 * @param {string} name 分类名称
 * @param {'EXPENSE'|'INCOME'} type 收支类型
 * @returns {string} emoji 字符
 */
export function categoryIcon(name, type) {
  if (!name) return type === 'INCOME' ? '＋' : '◌'
  const table = type === 'INCOME' ? INCOME_ICONS : EXPENSE_ICONS
  const exact = table[name]
  if (exact) return exact
  // 模糊匹配：包含关键词
  const lower = String(name).toLowerCase()
  for (const [key, icon] of Object.entries(table)) {
    if (key.length >= 2 && lower.includes(key.toLowerCase())) return icon
  }
  return type === 'INCOME' ? '＋' : '◌'
}

/**
 * 给定交易流水 item 和分类 Map，解析出该条流水对应的完整分类对象。
 * @param {object} item transaction 条目
 * @param {Map<string, object>} categoryMap Map(key → category)
 * @returns {object|null} 完整分类对象或 null（已删除/停用）
 */
export function resolveCategory(item, categoryMap) {
  const source = item.categorySource || 'CUSTOM'
  const id = source === 'SYSTEM' ? item.systemCategoryId : item.categoryId
  return categoryMap.get(`${source}:${id}`) || null
}

/**
 * 把 raw categories 数组构造成 Map（key → 完整分类对象）。
 * @param {Array} categories 后端返回的分类列表
 * @returns {Map<string, object>}
 */
export function buildCategoryMap(categories) {
  return new Map(categories.map(c => [`${c.source}:${c.id}`, c]))
}
