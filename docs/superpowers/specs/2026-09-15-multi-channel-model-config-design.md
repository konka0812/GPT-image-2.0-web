# 多通道模型配置设计

## 背景

当前每个用户只能配置一套图片 API（一个 Base URL、一个 Key、一个模型）。实际使用中用户会有多个中转站，每个中转站有多个分组，每个分组有独立 API Key 和多个模型；不同分组的模型支持的尺寸不同，价格也不同。

## 目标

- 支持配置多个中转站、每个站点多个分组、每个分组多个模型。
- 每个模型单独勾选支持的尺寸。
- 生图、改图、参考图、批量改图页面可选择使用哪个站点、哪个分组、哪个模型。
- 尺寸下拉只显示当前模型支持的尺寸。
- 兼容旧配置，自动迁移为一条默认通道。

## 数据结构

```js
image_channels: [
  {
    id: 'c1',
    name: '站A',
    base_url: 'https://api.a.com/v1',
    groups: [
      {
        id: 'g1',
        name: '便宜1K分组',
        api_key: 'sk-xxx',
        models: [
          { id: 'm1', name: 'gpt-image-2', sizes: ['1024x1024', '1536x1024', '1024x1536'] }
        ]
      }
    ]
  }
]
```

文本模型配置（`text_model`、`text_base_url`、`text_api_key`）保持不变。

## 设置页布局

```text
图片通道
├─ 站点：站A  [Base URL]                    [删除站点]
│   ├─ 分组：便宜1K分组  [API Key]           [删除分组]
│   │   ├─ 模型：gpt-image-2
│   │   │   尺寸：[✓]1536×1024 [✓]1024×1536 ... [全选/清空]
│   │   └─ [+ 添加模型]
│   └─ [+ 添加分组]
├─ 站点：站B ...
└─ [+ 添加站点]

文本模型（不变）
```

站点、分组、模型都支持增删。保存前校验：至少一个站点、Base URL 非空、API Key 非空、模型名非空、至少勾选一个尺寸。

## 生图页选择器

四个生成页面表单顶部增加一个下拉选择器，选项形如：

```text
站A · 便宜1K分组 · gpt-image-2
```

行为：

- 选项由设置页配置自动生成。
- 尺寸下拉只显示当前模型勾选的尺寸。
- 切换模型后如果当前尺寸不被支持，自动切换到第一个支持的尺寸。
- 选择保存到浏览器本地，各页面共用，刷新后保持。
- 未配置通道时回退为显示全部尺寸，提交时由后端提示先配置。

## 后端接口

### 新增 `GET /api/model-channels`

返回不含 API Key 的通道树，供生图页选择器使用：

```json
{
  "channels": [
    { "id": "c1", "name": "站A", "groups": [
      { "id": "g1", "name": "便宜1K分组", "models": [
        { "id": "m1", "name": "gpt-image-2", "sizes": ["1024x1024"] }
      ]}
    ]}
  ]
}
```

### 扩展 `GET/POST /api/settings`

- GET 返回 `image_channels`（含 Key）与文本模型字段。
- POST 接收 `image_channels` 与文本模型字段，校验后保存。

### 生成请求增加目标标识

```json
{
  "prompt": "...",
  "size": "1024x1024",
  "channel_id": "c1",
  "group_id": "g1",
  "model_id": "m1"
}
```

后端按 id 解析 Base URL、Key、模型名，并校验尺寸是否在模型勾选范围内，不在范围内返回 400。

## 兼容旧配置

旧数据（`base_url` + `api_key` + `model`）在读取时自动转换为一条默认通道：

```text
默认站点 · 默认分组 · gpt-image-2（全部尺寸）
```

用户保存后即持久化为新格式。

## 模块划分

- `server/settings.js`：`normalizeChannels`、`findImageTarget`、`publicChannels`、`legacyChannels`。
- `server/index.js`：`GET /api/model-channels`、设置读写、生成接口解析目标通道。
- `src/model-channels.js`：`flattenChannels`、`parseSelectionKey`、`resolveOption`、`filterSizeOptions`。
- `src/use-model-channels.js`：加载通道、管理选择与本地存储、暴露可用尺寸。
- `src/components/ModelPicker.vue`：选择器组件。
- 四个生成页面接入选择器并按模型过滤尺寸。
- `src/views/Settings.vue`：重写为多站点、多分组、多模型编辑器。

## 测试策略

- 后端：通道规范化丢弃不完整项、按 id 解析与回退、尺寸校验、旧配置迁移、公开树不含 Key。
- 前端：展平选项、解析选择键、失效选择回退、尺寸过滤。
- 页面：四个生成页包含选择器；设置页包含通道编辑功能。

## 部署影响

- 需要重启 PM2（后端接口变更）。
- 部署前检查运行中任务，避免中断。
