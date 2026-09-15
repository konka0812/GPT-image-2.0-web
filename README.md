# GPT-Image 2.0 Web

基于 GPT-Image-2 的 AI 图像生成与编辑 Web 应用，支持用户认证、多通道模型配置、异步任务、提示词优化、单图/批量编辑和多参考图生成等功能。

## 兼容 OpenAI 格式

本项目完全兼容 OpenAI Images API 格式，只需在「设置」页配置中转站信息即可使用。

支持的 API 端点：
- `POST {base_url}/images/generations` - 文字生成图片
- `POST {base_url}/images/edits` - 图片编辑（支持多图输入）

请求格式示例：
```json
{
  "model": "gpt-image-2",
  "prompt": "your prompt here",
  "images": [{"image_url": "data:image/png;base64,..."}],
  "size": "3840x2160",
  "quality": "high"
}
```

任何兼容 OpenAI Images API 的服务都可以直接使用，包括但不限于：
- OpenAI 官方 API
- Azure OpenAI
- 第三方中转站

## 功能特性

- **用户系统** - 注册/登录，JWT 认证
- **多通道配置** - 支持配置多个中转站，每个站点多个分组（独立 API Key），每个分组多个模型，每个模型单独勾选支持的尺寸
- **生图页通道选择** - 可选择使用哪个站点、哪个分组、哪个模型；尺寸下拉自动只显示该模型支持的尺寸
- **AI 生图** - 文字生成图片，支持 10 种尺寸和 3 档画质，默认 3840x2160 + high
- **AI 改图** - 单张图片编辑，支持提示词控制
- **参考图生成** - 上传 1-16 张有序参考图，通过 Image 1、Image 2 等编号在提示词中指定用途，固定生成一张新图
- **批量改图** - 多张图片批量处理，进度追踪，ZIP 打包下载
- **异步任务** - 提交后立即返回，后台处理，前端轮询状态，支持同步等待和上游异步轮询两种模式
- **并发提交** - 任务运行中可继续提交新任务，无需等待
- **提示词优化** - 点击灯泡按钮，调用独立配置的文本模型自动优化提示词，支持生图/改图/参考图三种模板
- **历史记录** - 用户独立的生成/编辑历史，支持单条删除和一键清空
- **设置安全** - 设置页默认只读，点击「编辑配置」后才能修改，避免误触删除；保存成功有确认弹窗
- **自动重试** - 上游超时/502/524 自动重试，最多 3 次

## 界面预览

### AI 生图

![AI 生图](docs/生图.png)

### AI 改图

![AI 改图](docs/改图.png)

### 批量改图

![批量改图](docs/批量改图.png)

### 历史记录

![历史记录](docs/历史记录.png)

## 技术栈

- **前端**: Vue 3 + Vite + TailwindCSS
- **后端**: Node.js + Express
- **数据库**: JSON 文件存储（轻量级，无需配置）
- **部署**: PM2 进程管理

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/konka0812/GPT-image-2.0-web.git
cd GPT-image-2.0-web
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3003
JWT_SECRET=your-jwt-secret-here
UPLOAD_DIR=./uploads
```

### 4. 构建前端

```bash
npm run build
```

### 5. 启动服务

```bash
npm start
```

或使用 PM2：

```bash
pm2 start ecosystem.config.cjs
```

## 项目结构

```
├── src/                         # 前端源码
│   ├── views/                   # 页面组件
│   │   ├── Login.vue            # 登录/注册
│   │   ├── Generate.vue         # AI 生图
│   │   ├── EditImage.vue        # 单图编辑
│   │   ├── ReferenceGenerate.vue # 多参考图生成
│   │   ├── BatchEdit.vue        # 批量编辑
│   │   ├── History.vue          # 历史记录
│   │   └── Settings.vue         # 设置页（只读 + 编辑模式）
│   ├── components/              # 公共组件
│   │   ├── TaskStatus.vue       # 任务状态面板
│   │   ├── RecordCard.vue       # 历史记录卡片
│   │   └── PromptOptimizer.vue  # 提示词优化
│   ├── image-sizes.js           # 尺寸目录（带标签）
│   ├── model-channels.js        # 通道展平与选择工具
│   ├── use-model-channels.js    # 通道加载与选择状态
│   ├── use-image-task.js        # 任务轮询 Hook
│   ├── task-feedback.js         # 任务反馈工具
│   ├── reference-images.js      # 参考图管理
│   ├── App.vue                  # 根组件
│   └── main.js                  # 入口
├── server/                      # 后端源码
│   ├── index.js                 # Express 主服务
│   ├── db.js                    # JSON 数据库（原子写入）
│   ├── auth.js                  # JWT 认证
│   ├── jobs.js                  # 异步任务注册表
│   ├── utils.js                 # 图片 API 调用与重试
│   ├── settings.js              # 通道配置校验与解析
│   ├── reference.js             # 参考图校验与构建
│   └── prompt-optimizer.js      # 提示词优化与系统提示词
├── test/                        # 测试
├── package.json
├── vite.config.js
└── ecosystem.config.cjs         # PM2 配置
```

## API 说明

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/settings` | GET/POST | 获取/设置完整配置（含分组 API Key） |
| `/api/model-channels` | GET | 获取生图页可用的通道列表（不含 API Key） |
| `/api/images/generate` | POST | AI 生图（异步，返回 jobId） |
| `/api/images/edit` | POST | 单图编辑（异步，返回 jobId） |
| `/api/images/reference` | POST | 1-16 张有序参考图生成（异步，返回 jobId） |
| `/api/images/tasks/:jobId` | GET | 查询异步任务状态 |
| `/api/images/edit/batch` | POST | 批量编辑 |
| `/api/images/edit/batch/:jobId` | GET | 查询批量任务进度 |
| `/api/optimize-prompt` | POST | 提示词优化 |
| `/api/history` | GET/DELETE | 历史记录 |
| `/api/history/:kind/:id` | DELETE | 删除单条历史记录 |

## 多通道配置

### 配置结构

```text
中转站（Base URL）
└── 分组（独立 API Key）
    └── 模型（勾选支持的尺寸）
```

不同分组可以有不同的价格和尺寸支持范围，例如便宜分组只支持 1K，高级分组支持全部尺寸。

### 设置页

设置页默认为只读视图，API Key 自动打码显示。点击右上角「编辑配置」后才可修改：

```text
图片通道                    [+ 添加站点]
├─ 站点：[站A]  [Base URL]              [删除站点]
│   ├─ 分组：[便宜1K分组]  [API Key]     [删除分组]
│   │   ├─ 模型：[gpt-image-2]
│   │   │   [全选尺寸] [清空尺寸] [删除模型]
│   │   │   ☑ 3:2 横版 1536×1024  ☑ 2:3 竖版 1024×1536 ...
│   │   └─ [+ 添加模型]
│   └─ [+ 添加分组]
└─ [+ 添加站点]
```

编辑完成后点击「保存设置」，保存成功会弹出确认窗口；点击「取消」会丢弃改动并回到只读视图。

### 生图页选择

四个生成页面顶部有通道选择器，格式为 `站点 · 分组 · 模型`：

- 尺寸下拉只显示当前模型勾选的尺寸
- 切换模型后如果当前尺寸不支持，会自动切换到第一个支持的尺寸
- 选择保存在浏览器本地，各页面共用

### 请求示例

生成任务时附带通道标识：

```json
{
  "prompt": "一只橘猫",
  "size": "1024x1024",
  "channel_id": "c1",
  "group_id": "g1",
  "model_id": "m1"
}
```

后端按 id 解析出 Base URL、Key 和模型名，并校验尺寸是否在该模型勾选范围内。

### 兼容旧配置

旧版本的单模型配置（`base_url` + `api_key` + `model`）会自动迁移为：

```text
默认站点 · 默认分组 · gpt-image-2（全部尺寸）
```

用户保存后即持久化为新格式。

## 支持的图片尺寸

生图页按以下顺序展示：

| 标签 | 尺寸 |
|------|------|
| 3:2 横版 | 1536×1024 |
| 2:3 竖版 | 1024×1536 |
| 3:2 横版 | 3520×2336 |
| 2:3 竖版 | 2336×3520 |
| 4:3 横版 | 2880×2160 |
| 3:4 竖版 | 2160×2880 |
| 16:9 横版 | 3840×2160 |
| 9:16 竖版 | 2160×3840 |
| 1:1 方图 | 1024×1024 |
| 1:1 方图 | 2048×2048 |

## 提示词优化

每个生成页面的提示词框右上角有灯泡按钮，点击后调用文本模型自动优化提示词：

- **生图模板** - 按主体/环境/构图/视觉/文字/必须满足/避免结构优化
- **编辑模板** - 先保留不变内容，再描述修改需求
- **参考图模板** - 编辑模板 + 参考图编号说明

优化完成后可在弹窗中编辑并采用，直接替换原提示词。

## License

MIT
