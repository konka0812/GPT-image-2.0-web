# Reference Image Generation Design

## Goal

Add an independent "参考图生成" workflow where a user uploads up to 16 ordered reference images, describes their roles by `Image 1`, `Image 2`, and so on, and generates one new image.

## Scope

- Add a new navigation item and route named "参考图生成".
- Preserve the existing visual language and two-column page template.
- Keep single-image editing and batch editing unchanged.
- Do not restore the removed `/api/images/transform` endpoint.

## Page Layout

The page uses the existing `420px + result` desktop layout.

The left control panel contains:

- A compact reference-image upload area.
- A two-column grid of small thumbnails.
- An `Image N` label on every thumbnail.
- Individual remove controls and a clear-all control.
- Drag-and-drop ordering.
- A concise usage guide.
- Prompt, output size, quality, and output format controls.
- One generation button.

The right panel shows the generated image and download action using the existing result presentation.

The layout must remain usable on mobile, where the controls and result stack vertically.

## Reference Ordering

- Users can add images in one or multiple file selections.
- The first displayed thumbnail is `Image 1`, followed by `Image 2` through `Image 16`.
- Dragging a thumbnail changes its position and immediately recalculates every label.
- Removing an image closes the gap and continuously renumbers the remaining images.
- The frontend appends files to multipart form data in the exact displayed order.
- The backend preserves that multipart order when constructing the upstream `images` array.

## User Guidance

Display this explanation near the thumbnails:

> 图片会按照当前顺序编号为 Image 1、Image 2、Image 3…。请在提示词中通过编号说明每张图的用途，例如：“Image 1 作为背景，把 Image 2 放在左侧，Image 3 放在右下角”。拖动缩略图可以调整编号。位置由 AI 根据描述理解，不是精确像素坐标。

## Validation

- Require at least one reference image.
- Allow at most 16 reference images.
- Reject non-image files.
- Keep the existing per-file Multer size limit.
- Require a non-empty prompt.
- Always request exactly one output image.
- Show clear frontend and backend errors for validation failures.

## Backend API

Add:

```text
POST /api/images/reference
```

The endpoint accepts multipart form data:

- `files`: 1-16 ordered image files.
- `prompt`: the composition instruction.
- `size`: one of the existing supported sizes.
- `quality`: `low`, `medium`, or `high`.
- `output_format`: `png`, `jpeg`, or `webp`.

The backend converts each uploaded file to a data URL, preserving order, and sends one upstream request:

```json
{
  "model": "<user setting>",
  "prompt": "<prompt>",
  "images": [
    { "image_url": "data:image/png;base64,..." },
    { "image_url": "data:image/png;base64,..." }
  ],
  "size": "3840x2160",
  "quality": "high",
  "output_format": "png",
  "n": 1
}
```

It calls the existing `/images/edits` upstream endpoint through `callWithFallback`, retaining support for:

- Synchronous HTTP 200 responses.
- Asynchronous HTTP 202 task polling.
- Statusless completed task responses.
- `b64_json` and URL image results.
- Existing retry and fallback behavior.

## History

Create one edit history record per reference-generation request with:

- `type: "reference"`.
- The prompt and output options.
- Ordered source file names stored in `source_image`.
- The generated local image path.
- Existing running, success, and failure states.

Existing history records remain unchanged.

## Testing

- Frontend ordering utility tests prove drag reorder and deletion produce continuous labels and file order.
- Backend request-construction tests prove 1 and 16 files preserve their order and force `n: 1`.
- Backend validation tests reject zero and more than 16 files.
- Route tests prove `/api/images/reference` exists and `/api/images/transform` remains absent.
- Existing model, polling URL, and statusless-result tests continue to pass.
- Run Node syntax checks and the Vite production build.
- Deploy and verify the application responds on port 3003.

## Out Of Scope

- Precise pixel coordinates.
- Per-image masks.
- More than 16 reference images.
- Multiple generated outputs per request.
- Restoring the old two-image transform route.
