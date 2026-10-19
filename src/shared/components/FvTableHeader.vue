<script setup lang="ts">
/**
 * 表头声明组件（无渲染，2026-10-15）：在 FvTable 默认插槽中声明一列，
 * 由 FvTable 收集全部 FvTableHeader 生成表格列。
 * - headerType：text=文本 / switch=FvSwitch / multiValue=多值单元格（FvMultiValueCell：首值标签+[总数]，悬停全列）/
 *   custom=客制化（default 插槽填充）/ action=操作列
 * - action 列通过 actions 设置多个动作（edit/delete/view）；不声明 action 列则不显示该列
 * - headerClass：作用于 text/switch 单元格内容的自定义样式类
 */
defineOptions({ name: 'FvTableHeader' })

withDefaults(
  defineProps<{
    /** 列标题（调用方传已翻译文案） */
    title?: string
    /** 列字段名（action 列无需） */
    dataKey?: string
    headerType?: 'text' | 'switch' | 'multiValue' | 'custom' | 'action'
    headerClass?: string
    align?: 'start' | 'center' | 'end'
    /** 点击表头排序：正序 → 倒序 → 恢复原始顺序（仅 text 列） */
    sort?: boolean
    /** 列级/行级禁用（2026-10-16 通用化，原 switchDisabled）：不可点击的禁用态、非隐藏；
        传布尔 = 整列禁用；传谓词 = 逐行判定（内置行保护等场景）。
        当前作用于 switch 单元格（不写回行数据、不抛 switch-change），未来扩展的单元格类型同字段生效 */
    headerDisabled?: boolean | ((row: unknown) => boolean)
    /** 操作列逐行禁用谓词（内置行保护等）：命中按钮置灰不可点 */
    actionDisabled?: (row: unknown, action: 'edit' | 'delete' | 'view') => boolean
    /** 操作列禁用态悬停提示文案（actionDisabled 命中时显示） */
    actionDisabledHint?: string
    /** action 列的动作集合 */
    actions?: ('edit' | 'delete' | 'view')[]
  }>(),
  { headerType: 'text' },
)
</script>
