# 历史单条删除、刷新反馈、并发提交与默认参数设计

## 背景

当前系统存在以下交互与默认值问题：

1. 历史记录只能一键清空，无法删除单条。
2. 历史页刷新按钮没有反馈，用户不确定是否已刷新。
3. 提交一个图片任务后，生成按钮会保持禁用直到任务结束，导致无法连续提交多个任务。
4. 默认图片尺寸与质量偏低，需要统一改为 `3840x2160` + `high`。

## 目标

- 历史记录支持单条删除。
- 刷新按钮点击后给出“已刷新”反馈。
- 任务提交后允许继续提交新任务，新任务会替换当前结果面板显示。
- 所有生成相关页面默认尺寸改为 `3840x2160`，默认质量改为 `high`。

## 方案

### 1. 历史记录单条删除

#### 后端

新增接口：

```http
DELETE /api/history/:kind/:id
```

- `kind` 只能是 `generation` 或 `edit`。
- 只删除 `user_id` 与当前登录用户匹配的记录。
- 操作成功后返回 `{ ok: true }`。
- 保留现有的 `DELETE /api/history` 一键清空接口。

#### 前端

- `History.vue` 给 `RecordCard` 增加 `kind` prop（`generation` 或 `edit`）。
- `RecordCard.vue` 在记录右侧增加“删除”按钮。
- 点击后先弹窗 `confirm('确定删除这条记录吗？')` 确认。
- 确认后调用 `DELETE /api/history/:kind/:id`。
- 删除成功后从本地对应数组移除该条记录，不重新请求整页。
- 运行中的记录也允许删除；删除仅影响历史记录展示，不影响后台正在执行的任务。

### 2. 历史界面刷新反馈

- `History.vue` 增加一个临时提示状态 `refreshMessage`。
- 点击“刷新”调用 `load()`，请求成功后设置 `refreshMessage = '已刷新'`。
- 2 秒后自动清空提示。
- 样式复用现有成功提示：`bg-emerald-500/15 text-emerald-200`。

### 3. 允许任务并发提交

- `useImageTask.js` 中：
  - `busy` 不再包含 `loading`，仅表示“正在提交请求”。
  - 新增 `running` computed，表示当前面板是否有任务在运行（用于结果面板显示）。
- 各生成页面按钮：
  - `:disabled="submitting"`，仅在提交请求过程中禁用。
  - 提交成功后调用 `start(jobId)`，新任务会替换当前面板显示。
  - 用户可在旧任务运行期间继续提交新任务。
- 旧任务仍在后台运行，处理完成后会写入历史记录，用户可在历史页查看。

### 4. 默认参数改为 3840x2160 + high

以下页面的表单初始值统一调整：

| 页面 | 默认 size | 默认 quality |
|---|---|---|
| Generate.vue | 3840x2160 | high |
| EditImage.vue | 3840x2160 | high |
| ReferenceGenerate.vue | 3840x2160 | high |
| BatchEdit.vue | 3840x2160 | high |

## 数据流

### 单条删除

```
用户点击删除
  → confirm 确认
  → axios.delete(`/api/history/${kind}/${id}`)
  → 后端从 data.generations 或 data.edits 中移除对应记录
  → 前端从本地数组 splice 移除
  → UI 立即更新
```

### 刷新反馈

```
用户点击刷新
  → load()
  → 请求成功后设置 refreshMessage = '已刷新'
  → setTimeout 2 秒后清空
```

### 并发提交

```
用户点击生成
  → submitting = true
  → axios.post('/api/images/generate')
  → start(jobId) 开始轮询新任务
  → submitting = false（按钮恢复可点）
  → 用户可再次点击生成，重复上述流程，面板始终显示最新任务
```

## 接口变更

新增：

```http
DELETE /api/history/:kind/:id
```

无其他接口变更。

## 测试策略

- 单元测试：
  - `DELETE /api/history/generation/:id` 只删除当前用户记录。
  - `DELETE /api/history/edit/:id` 只删除当前用户记录。
  - 删除后该记录不再出现在 `/api/history` 返回结果中。
  - 所有生成相关页面源码中默认 `size` 为 `3840x2160`、默认 `quality` 为 `high`。
  - `useImageTask` 的 `busy` 不再依赖 `loading`。
- 手动验证：
  - 提交任务后按钮立即恢复，可继续提交第二个任务。
  - 历史页删除单条后立即消失。
  - 点击刷新后出现“已刷新”提示并自动消失。
  - 设置页默认说明仍为 `https://<your-relay-domain>/v1`。

## 部署影响

- 仅前端与 Node 后端变更，不需要改动数据库结构。
- 需要重启 PM2 使后端接口生效。
- 部署前检查是否有运行中的图片任务，避免重启中断。
