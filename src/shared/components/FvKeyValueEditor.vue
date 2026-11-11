<script setup lang="ts">
import { ref, watch } from 'vue'

import FvStringListEditor from '@/shared/components/FvStringListEditor.vue'

/**
 * Key-Value Map 形态编辑器（shared Fv 族；2026-11-10 以 shared/FvKeyValueEditor 首抽→降级模块件 JsonMapEditor→
 * 更名 SystemMiscJsonMapEditor→**2026-11-12 升回 shared/FvKeyValueEditor**：飞书组 feishuGroups 成为第二个
 * 跨模块消费方（monitor-alarm AlarmCfgEditor），达 shared 门槛；Key/Value 双列 shared FvStringListEditor、
 * 事件驱动 Map 变更——用户定稿口径）：
 * - **左列 = Key List**：FvStringListEditor `selectable` + `:editable="false"`（**支持新增/删除/选择、不支持编辑改名**）；
 * - **右列 = Value List**：FvStringListEditor `:selectable="false"`（**支持新增/修改/删除、不支持选择**）；
 * - **事件接线**（FvStringListEditor 自定义事件四件套，均在出参同步后抛）：
 *   - Key `select`：选中 → 从 Map 查该 key 的 value 回显右列（**String 一行 / List<string> 多行**）；
 *     **反选（null）→ 清空右列 Value**；
 *   - Key `add`：Map 增加该 key、**value 置空 []**；Key `remove`：Map 删除该 key（若为选中 key 连带反选清右列）；
 *   - Value `add`/`edit`/`remove`：把右列当前行集合写回 Map 选中 key 的 value；
 * - **打开即回显**：Map 形态挂载时自动分离 key 入左列、**默认选中第一个 key** 并把其 value 回显右列；
 * - v-model 为 Record<string, string[]>（值归一行集合；标量 String 播种时升单元素数组——显示即一行）；
 *   提交换算（每 key 0 行→""/1 行→标量/>1 行→数组）仍归调用方（System Misc 编辑弹窗 §3.5）；
 * - `disabled` = 只读：左列禁增删（选择保留供浏览）、右列三钮全隐；`maxKeys`/`keyMaxlength`/`valueMaxlength` 门控透传；
 * - **外部变更自动重播种**（切页签/重置草稿）：v-model 被外部改写时左列 key、选中态（原 key 仍在则保持、
 *   否则回首 key）、右列行集合一并重建（快照对比防自激回环，FvStringListEditor 同契约）。
 */
withDefaults(
  defineProps<{
    disabled?: boolean
    /** key 数上限（左列添加行到顶隐藏） */
    maxKeys?: number
    /** key 输入字符上限 */
    keyMaxlength?: number
    /** value 行输入字符上限 */
    valueMaxlength?: number
    /** 左列 Key 列表标题（透传 FvStringListEditor label；空=不渲染标题行） */
    keyLabel?: string
    /** 右列 Value 列表标题 */
    valueLabel?: string
    /** 左列问号 hint（非空即显图标） */
    keyHint?: string
    /** 右列问号 hint（非空即显图标） */
    valueHint?: string
    /** 两列列表固定高度（透传 FvStringListEditor height） */
    height?: string
    /** 右列 Value 行提交初校验（透传 FvStringListEditor rowRule；左列 Key 不挂） */
    valueRowRule?: (v: string) => string
    /** 外部错误文案（透传右列 Value 编辑器徽标位） */
    error?: string
  }>(),
  {
    disabled: false,
    maxKeys: undefined,
    keyMaxlength: 255,
    valueMaxlength: undefined,
    keyLabel: undefined,
    valueLabel: undefined,
    keyHint: undefined,
    valueHint: undefined,
    height: '240px',
    valueRowRule: undefined,
    error: undefined,
  },
)

const model = defineModel<Record<string, string[]>>({ required: true })

/** Map 工作副本（事件驱动变更的唯一源） */
const map = ref<Record<string, string[]>>(
  Object.fromEntries(Object.entries(model.value).map(([k, v]) => [k, [...v]])),
)
/** 左列 key 行集合（FvStringListEditor v-model） */
const keyList = ref<string[]>(Object.keys(map.value))
/** 选中 key（左列 v-model:selected）；null = 反选/无选中 */
const selectedKey = ref<string | null>(keyList.value[0] ?? null)
/** 右列 value 行集合（FvStringListEditor v-model）；打开即回显选中 key 的 value */
const valueRows = ref<string[]>([...(selectedKey.value ? (map.value[selectedKey.value] ?? []) : [])])

/** 出参同步：lastEmitted 快照供外部改写判别（watch 到同快照 = 自己的 emit 回流，跳过重播种） */
let lastEmitted = JSON.stringify(model.value)
function syncModel() {
  lastEmitted = JSON.stringify(map.value)
  model.value = Object.fromEntries(Object.entries(map.value).map(([k, v]) => [k, [...v]]))
}

/** 外部改写（切页签/重置草稿）→ 三态一并重播种：key 列、选中态（原 key 优先、否则首 key）、右列行集合 */
watch(model, (v) => {
  const snap = JSON.stringify(v)
  if (snap === lastEmitted) return
  lastEmitted = snap
  map.value = Object.fromEntries(Object.entries(v).map(([k, rows]) => [k, [...rows]]))
  keyList.value = Object.keys(map.value)
  selectedKey.value = keyList.value.includes(selectedKey.value as string)
    ? selectedKey.value
    : (keyList.value[0] ?? null)
  valueRows.value = [...(selectedKey.value ? (map.value[selectedKey.value] ?? []) : [])]
})

/* ===== 左列 Key 事件 ===== */

/** Key 选中：查 Map 回显右列；反选（null）：清空右列 Value（用户定稿） */
function onKeySelect(key: string | null) {
  valueRows.value = [...(key ? (map.value[key] ?? []) : [])]
}

/** Key 新增：Map 增 key、value 置空（用户定稿）；**重名拒绝**——Record 语义下重名不可表示，
 *  外部改写 keyList 去重触发左列编辑器重播种、回收刚固化的重复行（沿用旧版改名重名拒绝口径） */
function onKeyAdd(key: string) {
  if (key in map.value) {
    const dedup = [...new Set(keyList.value)]
    if (dedup.length !== keyList.value.length) keyList.value = dedup
    return
  }
  map.value[key] = []
  // 新组自动选中（2026-11-12 实测缺陷修：不选中则右列 addable=!!selectedKey 锁死，
  // 加了组却要手点一下组名才能录值）；右列清空待录
  selectedKey.value = key
  valueRows.value = []
  syncModel()
}

/** Key 删除：Map 删 key；若为选中 key 连带反选 + 清右列 */
function onKeyRemove(key: string) {
  delete map.value[key]
  if (selectedKey.value === key) {
    selectedKey.value = null
    valueRows.value = []
  }
  syncModel()
}

/* ===== 右列 Value 事件：三路均把当前行集合写回 Map 选中 key ===== */

function onValueMutate() {
  if (!selectedKey.value) return
  map.value[selectedKey.value] = [...valueRows.value]
  syncModel()
}
</script>

<template>
  <div class="json-map">
    <!-- 左列 Key List：可增/删/选，不可编辑改名（editable=false 隐藏编辑钮） -->
    <div class="json-map__keys">
      <FvStringListEditor
        v-model="keyList"
        v-model:selected="selectedKey"
        selectable
        :editable="false"
        :addable="!disabled"
        :deletable="!disabled"
        :maxlength="keyMaxlength"
        :max-rows="maxKeys"
        :label="keyLabel"
        :hint="keyHint"
        :height="height"
        :show-hint="!!keyHint"
        @select="onKeySelect"
        @add="onKeyAdd"
        @remove="onKeyRemove"
      />
    </div>

    <!-- 右列 Value List：可增/改/删，不可选；无选中 key 时禁添加（写了也无归属） -->
    <div class="json-map__values">
      <FvStringListEditor
        v-model="valueRows"
        :selectable="false"
        :addable="!disabled && !!selectedKey"
        :editable="!disabled"
        :deletable="!disabled"
        :maxlength="valueMaxlength"
        :label="valueLabel"
        :hint="valueHint"
        :height="height"
        :show-hint="!!valueHint"
        :row-rule="valueRowRule"
        :error="error"
        @add="onValueMutate"
        @edit="onValueMutate"
        @remove="onValueMutate"
      />
    </div>
  </div>
</template>

<style scoped>
.json-map {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.json-map__keys {
  flex: 0 0 220px;
  min-width: 0;
}

.json-map__values {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
