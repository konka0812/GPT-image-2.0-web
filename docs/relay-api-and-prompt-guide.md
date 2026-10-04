# 中转站 文生图 / 图生图 调用文档（可直接对接 OpenAI Images 兼容接口）

> 适用场景：直接调用中转站的 `/images/generations`（文生图）和 `/images/edits`（图生图），不经过任何自建服务。
> 目标：让接手的人（或 AI 会话）在 10 分钟内能跑通全流程。

---

## 0. 快速开始（3 步）

```text
1) 准备 Base URL 和 API Key（如 https://your-relay.example.com/v1 和 sk-xxxx）
2) 调 POST {BASE_URL}/images/generations 文生图
3) 若返回 202 + poll_url，则轮询 poll_url 直到拿到图片
```

认证方式统一为：

```http
Authorization: Bearer {API_KEY}
```

---

## 1. 两种提交方式，两种返回形态（务必都处理）

### 提交方式

| 场景 | 端点 | 提交格式 |
|---|---|---|
| 文生图 | `POST {BASE_URL}/images/generations` | JSON |
| 图生图 / 参考图 | `POST {BASE_URL}/images/edits` | `multipart/form-data`（`image` 文件字段）或 JSON（`images[].image_url` = base64 data URL） |

### 返回形态（同一个端点可能返回不同形态，必须全都兼容）

| 形态 | 特征 | 处理 |
|---|---|---|
| A. 同步完成 | `HTTP 200`，`data[0].url` 或 `data[0].b64_json` | 直接取图 |
| B. 异步任务 | `HTTP 202` + `poll_url` + `poll_after_ms` | 轮询 `poll_url` 直到 `status` 为完成态 |
| C. 平台任务对象 | 响应里有 `assets[]` 或 `summary.assets[]` | 从 `assets` 取图（字段 `signed_url` / `url` / `download_url`） |

> 经验：同一个中转站在不同时间可能返回 A 或 B，代码里不要只写一种分支。

---

## 2. 支持的尺寸（实测可精确返回）

按「档位 + 比例」组织，共 21 个：

| 比例 | 1K | 2K | 4K |
|------|-----|-----|-----|
| 1:1 方图 | 1024×1024 | 2048×2048 | 2880×2880 |
| 3:2 横版 | 1536×1024 | 2048×1360 | 3520×2336 |
| 2:3 竖版 | 1024×1536 | 1360×2048 | 2336×3520 |
| 4:3 横版 | 1360×1024 | 2048×1536 | 3312×2480 |
| 3:4 竖版 | 1024×1360 | 1536×2048 | 2480×3312 |
| 16:9 横版 | 1536×864 | 2048×1152 | 3840×2160 |
| 9:16 竖版 | 864×1536 | 1152×2048 | 2160×3840 |

**重要：尺寸会被"吸附"**

中转站只接受"合法尺寸"，不在网格内会被自动改成最近的合法值，例如：

```text
请求 1365×1024 → 实际返回 1376×1024
请求 1024×576  → 实际返回 1088×608
请求 3840×2880 → 实际返回 3312×2480（超出像素预算，被缩小）
```

**因此：**
- 上表 21 个尺寸是安全的，直接用。
- 用新尺寸前先跑一次，读回图片的真实宽高比对（`file xxx.png` 或读 PNG 的 IHDR）。
- 如果请求 4K 但模型不支持，可能收到"上游未返回所选 4K 尺寸，实际 2880×2880"这类提示，属于降级返回，不是报错。

**质量参数**：`quality` 支持 `low` / `medium` / `high`。`quality` 和 `size` 都影响耗时和费用，4K + high 最慢（可能 5-15 分钟）。

---

## 3. 文生图（`/images/generations`）

### 请求参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `model` | 是 | 如 `gpt-image-2`，具体可用值问中转站 |
| `prompt` | 是 | 提示词，见第 7 节 |
| `size` | 否 | 见第 2 节，默认 `1024x1024` |
| `quality` | 否 | `low` / `medium` / `high` |
| `n` | 否 | 生成张数，注意部分通道强制为 1 |
| `output_format` | 否 | `png` / `jpeg` / `webp` |
| `response_format` | 否 | **实测常被忽略**，不要依赖它返回 `b64_json` |

### curl 示例

```bash
curl -X POST "$BASE_URL/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "一只橘猫坐在赛博朋克霓虹街道上，旁边有「深夜食堂」招牌，中文清晰可读",
    "size": "1360x1024",
    "quality": "high",
    "n": 1
  }'
```

### 返回示例（异步）

```json
{
  "status": "queued",
  "poll_url": "/v1/images/tasks/imgtask_xxx",
  "poll_after_ms": 2000
}
```

---

## 4. 图生图（`/images/edits`）

### 方式一：multipart（推荐，稳定）

```bash
curl -X POST "$BASE_URL/images/edits" \
  -H "Authorization: Bearer $API_KEY" \
  -F "model=gpt-image-2" \
  -F "prompt=把背景换成纯白色，保持主体不变" \
  -F "size=1360x1024" \
  -F "quality=high" \
  -F "image=@input.png;type=image/png"
```

### 方式二：JSON + base64

```json
{
  "model": "gpt-image-2",
  "prompt": "把背景换成纯白色，保持主体不变",
  "size": "1360x1024",
  "quality": "high",
  "images": [{ "image_url": "data:image/png;base64,iVBORw0KGgo..." }]
}
```

### 多图参考

多张参考图按顺序放进数组 / 多个 `image` 字段，提示词里用编号说明用途：

```text
参考图用途：
- Image 1 提供人物身份：脸型、五官、年龄、发型
- Image 2 提供服装：款式、颜色、材质
- Image 3 提供色彩风格：深蓝色调、城市夜景、柔和侧光

必须满足：人物身份以 Image 1 为准，服装以 Image 2 为准，色彩以 Image 3 为准。
```

### 排查：图片到底有没有送进去

如果发现"成图完全不参考输入图"，用返回的 `usage` 判断：

```json
{
  "usage": {
    "input_tokens_details": { "image_tokens": 0, "text_tokens": 24 }
  }
}
```

- `image_tokens > 0` → 输入图被正常读取
- `image_tokens = 0` → **中转站只转发了文本，图片没送进模型**（这是通道问题，不是提示词问题）

> 遇到这种情况：不要重复盲目重发，把 `image_tokens=0` 这个证据反馈给中转站，要求修复图片转发。

---

## 5. 任务状态与轮询

### 状态表

| 状态 | 含义 | 处理 |
|---|---|---|
| `queued` | 已入队 | 按 `poll_after_ms` 继续查询 |
| `dispatching` | 调度中，正在选通道 | 继续查询，**不要重复提交** |
| `running` | 正在生成 | 继续查询，活动状态通常返回 2000ms |
| `success` | 完成 | 取 `assets` / `data` 保存图片 |
| `failed` | 确认失败 | 记录 `error`，改参数后用新的幂等键重新发起 |
| `uncertain` | 上游超时/断线，结果未知 | **不要换新键盲目重发**，放宽等待继续查；仍无法确认时联系中转站 |
| `client_disconnected` | 同步请求返回前客户端断开 | 不代表模型没收到；先核对原任务和用量，避免重复生成 |
| `paused` | 等待中被暂停 | 宽限期内继续查；暂停任务需恢复后继续 |
| `canceled` | 已取消 | 终态，停止轮询 |

**注意：图片任务的完成状态是 `success`，不是 `completed`**（视频任务才用 `completed`）。判断时建议两者都接受。

### 建议的等待上限

| 场景 | 上限 |
|---|---|
| 默认（queued / dispatching / running） | 15 分钟 |
| 出现过 uncertain / client_disconnected | 放宽到 20 分钟 |
| paused 持续未恢复 | 2 分钟后放弃 |

### 轮询要点

1. 间隔优先用响应里的 `poll_after_ms`（毫秒），没给就用 2-3 秒，范围建议 1-10 秒。
2. 轮询接口本身要带 `Authorization: Bearer {API_KEY}`。
3. `poll_url` 可能是根相对路径（`/v1/images/tasks/xxx`），要拼成 `{BASE_URL 的 origin} + poll_url`。
4. 不要并发重复提交同一任务（会产生重复扣费）。

---

## 6. 结果图片怎么拿

优先级：

```text
1) b64_json                                  → base64 解码写文件
2) signed_url（约 6 小时有效，免鉴权）        → 直接下载，不要带 Key
3) url / download_url（需要 API Key）         → 下载时带 Authorization
4) 相对路径（/v1/images/tasks/xxx/assets/a.png）→ 拼上 BASE_URL 的 origin 再下载
```

**安全提醒**：`signed_url` 可能在别的域名（如 `media.xxx.com`），**不要把你的 API Key 发给第三方域名**。只有当下载地址与 Base URL 同主域时才带 Key。

图片结果可能出现在三个位置，都要读：

```python
def extract_items(payload):
    items = []
    if isinstance(payload.get("data"), list):
        items += payload["data"]
    if isinstance(payload.get("assets"), list):
        items += payload["assets"]
    summary = payload.get("summary") or {}
    if isinstance(summary.get("assets"), list):
        items += summary["assets"]
    return [i for i in items if i and (
        i.get("b64_json") or i.get("signed_url") or i.get("url") or i.get("download_url")
    )]
```

---

## 7. 错误处理与重试

| 错误 | 含义 | 建议 |
|---|---|---|
| `401` | 认证失败 | 检查 Key；偶发成功说明是通道不稳定 |
| `403` | 权限/内容策略拒绝 | 换提示词或换模型 |
| `413` | 上传图片过大 | 压缩后重试 |
| `502` | 上游网关错误 | **可重试** |
| `524` | 上游超时（Cloudflare） | **可重试**，或降低尺寸/质量 |
| 连接超时 / `fetch failed` | 网络问题 | **可重试** |
| `No available compatible accounts` | 上游无可用账号 | 稍后重试或换渠道 |
| `The generated images appear to be unsafe` | 内容安全拦截 | 改提示词 |

**重试建议**：只对 `502` / `524` / 超时 / 网络错误重试，指数退避（如 8s、16s），最多 3 次。`401` / `403` / 内容安全类不要重试。

**CORS 注意**：中转站一般不允许浏览器直连（会缺 CORS 头），**务必在服务端调用**。

---

## 8. 提示词指南

### 8.1 通用原则

- GPT Image 系列更适合**自然语言**，不需要 Stable Diffusion 式权重语法（如 `(cinematic:1.5)`）。
- 不要堆砌 `8K`、`masterpiece`、`超高清` 之类标签，写成**清晰、无冲突的视觉需求单**。
- 用具体描述代替抽象形容词：
  - 「构图高级」→「主体位于画面左侧三分之一，右侧保留留白」
  - 「光影好看」→「右上方柔光箱，阴影柔和、低对比度」
- 精确文字要加引号，并说明位置、字体、大小、换行。
- 负面要求只写少量关键项（3-5 条），优先正面描述想要的结果。
- 不要同时要求冲突风格（如「极简」+「丰富复杂」、「纪实摄影」+「3D 卡通」）。
- 能用接口参数控制的（尺寸、质量、透明背景），不要写进提示词。

### 8.2 文生图模板

```text
任务：为[用途]生成一张[比例]图片。

主体：
[主体外观、动作、材质、颜色、关键特征]

场景：
[地点、时间、背景和环境元素]

构图：
[景别、视角、主体位置、留白方向]

视觉：
[风格]；[主光方向、光线软硬、色彩、材质、景深]

画面文字：
准确显示「[文字]」，位于[位置]，使用[字体特点]。

必须满足：
- [最重要 3-5 项]

避免：
- [少量真正不能出现的问题]
```

**示例**

```text
任务：为高端电商详情页生成一张 1:1 产品主图。

主体：
一台哑光白色桌面咖啡机，三分之四侧前方视角，产品完整可见，
金属旋钮、出水口和蒸汽杆结构清晰，表面材质细腻，比例真实。

场景：
浅灰色无缝摄影棚背景，画面干净简洁。

构图：
中景，视线与产品平齐，产品位于画面左侧三分之一，右侧保留约 35% 留白。

视觉：
真实商业摄影；右上方大型柔光箱照明，阴影柔和自然，
金属部分适度反光，整体白/浅灰为主。

画面文字：
机身品牌文字准确显示为「MONO」，位于产品正面，现代无衬线字体。

必须满足：
- 产品结构清晰完整
- 透视与比例真实
- 画面简洁，适合电商详情页

避免：
- 不要添加咖啡杯、植物或装饰品
- 不要改变产品外形
- 不要出现额外文字或水印
```

### 8.3 图生图模板（先保留，再修改）

```text
以输入图作为主体、构图和身份的唯一依据。

必须保持不变：
- [人物/产品的外形、比例、位置]
- [面部特征、发型、服装、品牌标识]
- [相机视角、裁切范围、主体大小]

只修改：
- 将[原内容]改为[目标内容]
- 修改区域位于[明确位置]

修改要求：
- 新内容的透视、光线、阴影、景深与原图一致
- 边缘自然，不出现接缝或光照冲突
- 不增加其他人物、物体或文字

避免：
- 不要修改未指定的区域
- 不要改变主体外形和构图
```

**示例**

```text
以输入图片中的人物作为唯一身份参考。

必须保持不变：
- 脸型、五官比例、年龄、肤色
- 发型、表情、姿势、服装
- 人物在画面中的位置、大小和裁切范围

只修改：
- 将背景替换为傍晚的上海外滩
- 仅修改人物背后的背景区域

修改要求：
- 背景为真实摄影效果，环境光从人物右侧照射
- 人物边缘、肤色、阴影和景深与新背景自然融合

避免：
- 不要修改人物本身
- 不要增加其他人物、文字或前景装饰
```

### 8.4 多参考图分工写法

```text
参考图用途：
- Image 1 提供人物身份
- Image 2 只提供服装
- Image 3 只提供色彩风格

必须满足：各参考图特征自然融合，不要混淆用途。
```

### 8.5 常用技巧速查

| 想要的效果 | 推荐写法 |
|---|---|
| 精确构图 | 「主体位于画面左侧三分之一，右侧留白 35%」 |
| 精确光线 | 「右上方柔光箱，阴影柔和，低对比度」 |
| 精确文字 | 「准确显示「深夜食堂」，位于右上角，粗体无衬线，字号大」 |
| 系列一致性 | 复用同一张参考图做图生图，比每次从零生成稳定 |
| 局部修改 | 说明"只修改哪个区域"，并列出必须保留的内容 |
| 避免跑偏 | 少写负面词，多写"要什么" |

### 8.6 常见失败原因

| 现象 | 原因 | 对策 |
|---|---|---|
| 文字乱码 | 提示词没加引号/没说明位置字体 | 加引号 + 指定位置字体 |
| 成图不参考输入图 | `image_tokens = 0`（通道没转发图） | 反馈中转站；换渠道 |
| 人物变了 | 没写"必须保持不变" | 按图生图模板先列保留项 |
| 风格冲突 | 同时要求相反风格 | 只保留一种主风格 |
| 尺寸不对 | 请求了非法尺寸被吸附 | 用第 2 节的 21 个尺寸 |

---

## 9. 完整可运行脚本

### 9.1 Python

```python
import base64
import os
import time
from urllib.parse import urljoin

import requests

BASE_URL = os.environ.get("BASE_URL", "https://your-relay.example.com/v1").rstrip("/")
API_KEY = os.environ.get("API_KEY", "sk-xxxx")
HEADERS = {"Authorization": f"Bearer {API_KEY}"}
ORIGIN = BASE_URL.rsplit("/v1", 1)[0] + "/"


def absolute(url: str) -> str:
    return url if url.startswith("http") else urljoin(ORIGIN, url.lstrip("/"))


def extract_items(payload: dict) -> list:
    payload = payload if isinstance(payload, dict) else {}
    items = []
    if isinstance(payload.get("data"), list):
        items += payload["data"]
    if isinstance(payload.get("assets"), list):
        items += payload["assets"]
    summary = payload.get("summary") or {}
    if isinstance(summary.get("assets"), list):
        items += summary["assets"]
    return [
        i for i in items
        if i and (i.get("b64_json") or i.get("signed_url") or i.get("url") or i.get("download_url"))
    ]


def save_image(item: dict, index: int = 0, out_dir: str = ".") -> str:
    if item.get("b64_json"):
        data = base64.b64decode(item["b64_json"])
    else:
        signed = item.get("signed_url")
        url = absolute(signed or item.get("url") or item.get("download_url"))
        headers = {} if signed else HEADERS  # signed_url 是第三方域名，绝不要带 Key
        resp = requests.get(url, headers=headers, timeout=180)
        resp.raise_for_status()
        data = resp.content
    path = os.path.join(out_dir, f"output-{index}.png")
    with open(path, "wb") as f:
        f.write(data)
    return path


def poll(poll_url: str, timeout: float = 900, interval: float = 3.0) -> list:
    url = absolute(poll_url)
    started = time.time()
    while time.time() - started < timeout:
        time.sleep(interval)
        resp = requests.get(url, headers=HEADERS, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        after = data.get("poll_after_ms")
        if after:
            interval = min(max(after / 1000.0, 1.0), 10.0)
        status = data.get("status")
        print(f"  poll status={status} elapsed={int(time.time() - started)}s")
        items = extract_items(data)
        if items:
            return items
        if status in ("failed", "error", "rejected", "canceled", "cancelled"):
            raise RuntimeError(data.get("error") or data.get("message") or status)
    raise TimeoutError("polling timeout")


def submit(endpoint: str, payload: dict, files: dict | None = None) -> list:
    url = f"{BASE_URL}{endpoint}"
    if files:
        resp = requests.post(url, headers=HEADERS, data=payload, files=files, timeout=600)
    else:
        resp = requests.post(url, headers={**HEADERS, "Content-Type": "application/json"}, json=payload, timeout=600)
    text = resp.text
    try:
        data = resp.json()
    except Exception:
        data = {"raw": text[:300]}
    if resp.status_code == 202 and data.get("poll_url"):
        return poll(data["poll_url"])
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status_code}: {data}")
    items = extract_items(data)
    if items:
        return items
    if data.get("poll_url"):
        return poll(data["poll_url"])
    raise RuntimeError(f"unexpected response: {data}")


def text_to_image(prompt: str, size="1360x1024", quality="high", model="gpt-image-2", n=1) -> list:
    return submit("/images/generations", {
        "model": model, "prompt": prompt, "size": size, "quality": quality, "n": n,
    })


def image_to_image(image_path: str, prompt: str, size="1360x1024", quality="high", model="gpt-image-2") -> list:
    with open(image_path, "rb") as fh:
        files = {"image": (os.path.basename(image_path), fh, "image/png")}
        return submit("/images/edits", {
            "model": model, "prompt": prompt, "size": size, "quality": quality,
        }, files=files)


if __name__ == "__main__":
    items = text_to_image("一只橘猫坐在赛博朋克霓虹街道上，旁边有「深夜食堂」招牌，中文清晰可读")
    for i, item in enumerate(items):
        print("saved:", save_image(item, i))
```

### 9.2 Node.js

```javascript
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://your-relay.example.com/v1').replace(/\/$/, '')
const API_KEY = process.env.API_KEY || 'sk-xxxx'
const ORIGIN = BASE_URL.replace(/\/v1$/, '') + '/'
const HEADERS = { Authorization: `Bearer ${API_KEY}` }

const absolute = (url) => (url.startsWith('http') ? url : new URL(url.replace(/^\//, ''), ORIGIN).toString())

function extractItems(payload = {}) {
  const items = []
  if (Array.isArray(payload.data)) items.push(...payload.data)
  if (Array.isArray(payload.assets)) items.push(...payload.assets)
  if (Array.isArray(payload.summary?.assets)) items.push(...payload.summary.assets)
  return items.filter((i) => i && (i.b64_json || i.signed_url || i.url || i.download_url))
}

async function saveImage(item, index = 0) {
  let buffer
  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64')
  } else {
    const signed = Boolean(item.signed_url)
    const url = absolute(item.signed_url || item.url || item.download_url)
    const res = await fetch(url, signed ? {} : { headers: HEADERS })
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
    buffer = Buffer.from(await res.arrayBuffer())
  }
  const file = path.join(process.cwd(), `output-${index}.png`)
  fs.writeFileSync(file, buffer)
  return file
}

async function poll(pollUrl, timeoutMs = 900000, intervalMs = 3000) {
  const url = absolute(pollUrl)
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs))
    const res = await fetch(url, { headers: HEADERS })
    const data = await res.json()
    if (data.poll_after_ms) intervalMs = Math.min(Math.max(data.poll_after_ms, 1000), 10000)
    console.log(`  poll status=${data.status} elapsed=${Math.round((Date.now() - started) / 1000)}s`)
    const items = extractItems(data)
    if (items.length) return items
    if (['failed', 'error', 'rejected', 'canceled', 'cancelled'].includes(data.status)) {
      throw new Error(data.error || data.message || data.status)
    }
  }
  throw new Error('polling timeout')
}

async function submit(endpoint, { json, form }) {
  const res = form
    ? await fetch(`${BASE_URL}${endpoint}`, { method: 'POST', headers: HEADERS, body: form })
    : await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 300) } }
  if (res.status === 202 && data.poll_url) return poll(data.poll_url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`)
  const items = extractItems(data)
  if (items.length) return items
  if (data.poll_url) return poll(data.poll_url)
  throw new Error(`unexpected response: ${JSON.stringify(data)}`)
}

export function textToImage(prompt, { size = '1360x1024', quality = 'high', model = 'gpt-image-2', n = 1 } = {}) {
  return submit('/images/generations', { json: { model, prompt, size, quality, n } })
}

export function imageToImage(imagePath, prompt, { size = '1360x1024', quality = 'high', model = 'gpt-image-2' } = {}) {
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('size', size)
  form.append('quality', quality)
  form.append('image', new Blob([fs.readFileSync(imagePath)], { type: 'image/png' }), path.basename(imagePath))
  return submit('/images/edits', { form })
}

// 用法
const items = await textToImage('一只橘猫坐在赛博朋克霓虹街道上')
for (const [i, item] of items.entries()) console.log('saved:', await saveImage(item, i))
```

---

## 10. 对接检查清单

- [ ] Base URL 结尾是 `/v1`（调用时拼 `/images/generations`）
- [ ] 服务端调用（不要浏览器直连，避免 CORS）
- [ ] 同步 / 202 异步 / assets 三种返回都处理了
- [ ] `poll_url` 是相对路径时已拼 origin
- [ ] 轮询间隔用了 `poll_after_ms`，并设置总超时（建议 15 分钟）
- [ ] 完成状态判断包含 `success`（也兼容 `completed`）
- [ ] 终态包含 `failed` / `error` / `rejected` / `canceled`
- [ ] 图片优先取 `signed_url`，第三方域名不带 API Key
- [ ] 只对 502 / 524 / 超时做重试（最多 3 次）
- [ ] 编辑图先确认 `image_tokens > 0` 再判断提示词问题
```

---

## 11. 需要向中转站确认的信息

1. 可用模型名列表（如 `gpt-image-2` / `gpt-image-2.5`）以及各模型支持的尺寸档位
2. 各分组/模型的计费方式（按张、按分辨率、按质量？）
3. 编辑通道是否完整转发图片（要求能返回 `image_tokens > 0`）
4. 失败任务的扣费规则（`uncertain` / `client_disconnected` 如何处理）
5. 同步请求的上游超时时间（Cloudflare 524 的边界）
