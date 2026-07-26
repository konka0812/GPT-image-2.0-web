# Reference Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "参考图生成" page that sends 1-16 ordered reference images and one prompt to generate one new image.

**Architecture:** Add small pure helpers for ordered frontend file operations and backend payload construction so ordering and limits are testable without mounting Vue or Express. Add one Vue page and one authenticated multipart route that reuse the existing provider, polling, image-saving, and history infrastructure.

**Tech Stack:** Vue 3, Vue Router, Axios, Express, Multer, Node.js test runner, Vite, PM2

---

### Task 1: Ordered Reference Helpers

**Files:**
- Create: `src/reference-images.js`
- Create: `server/reference.js`
- Create: `test/reference-images.test.js`

- [ ] **Step 1: Write failing frontend order tests**

Create tests that call `appendReferenceFiles`, `moveReferenceFile`, and `removeReferenceFile`. Assert appending stops at 16, moving index 2 to index 0 produces the displayed order, and removal closes the gap.

- [ ] **Step 2: Write failing backend payload tests**

Assert `buildReferencePayload` preserves file order, converts buffers to ordered data URLs, uses the configured model, and always returns `n: 1`. Assert `validateReferenceFiles([])` and 17 files throw Chinese validation messages.

- [ ] **Step 3: Run tests to verify RED**

Run: `node --test test/reference-images.test.js`

Expected: FAIL because both helper modules are absent.

- [ ] **Step 4: Implement frontend helpers**

Create `src/reference-images.js` with immutable array operations:

```js
export const maxReferenceImages = 16

export function appendReferenceFiles(current, incoming) {
  return [...current, ...incoming].slice(0, maxReferenceImages)
}

export function moveReferenceFile(items, from, to) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function removeReferenceFile(items, index) {
  return items.filter((_, itemIndex) => itemIndex !== index)
}
```

- [ ] **Step 5: Implement backend helpers**

Create `server/reference.js` exporting `maxReferenceImages`, `validateReferenceFiles`, and `buildReferencePayload`. Validation requires 1-16 image MIME files. Payload fields are `model`, `prompt`, ordered `images`, `size`, `quality`, `output_format`, and `n: 1`.

- [ ] **Step 6: Run tests to verify GREEN**

Run: `node --test test/reference-images.test.js`

Expected: all reference helper tests pass.

### Task 2: Reference Image Page

**Files:**
- Create: `src/views/ReferenceGenerate.vue`
- Modify: `src/main.js`
- Modify: `src/App.vue`

- [ ] **Step 1: Add the page component**

Use the existing `lg:grid-cols-[420px_1fr]` page template. The left panel includes a multi-file input, compact two-column thumbnails, labels derived from `index + 1`, remove and clear actions, native drag events, usage instructions, prompt and output controls, and a submit button. The right panel uses the existing result preview and download pattern.

- [ ] **Step 2: Preserve displayed order in submission**

Build `FormData`, append each current file using the key `files`, then append prompt, size, quality, and output format. POST to `/api/images/reference` and display `res.data.images[0]`.

- [ ] **Step 3: Add route and navigation**

Import the page in `src/main.js`, register `/reference`, and add `{ path: '/reference', label: '参考图生成' }` in `src/App.vue` after the normal edit page.

- [ ] **Step 4: Build the frontend**

Run: `npm run build`

Expected: Vite build succeeds.

### Task 3: Reference Generation API

**Files:**
- Modify: `server/index.js`
- Modify: `test/routes.test.js`

- [ ] **Step 1: Extend the route regression test**

Assert `server/index.js` contains `/api/images/reference` while continuing to assert `/api/images/transform` is absent.

- [ ] **Step 2: Verify route test RED**

Run: `node --test test/routes.test.js`

Expected: FAIL because the reference route is absent.

- [ ] **Step 3: Add the reference route**

Register:

```js
app.post('/api/images/reference', requireAuth, upload.array('files', 16), async (req, res) => {
  // Validate prompt and files, create one type=reference history record,
  // call /images/edits once, save one result, update history, return images.
})
```

Use `buildReferencePayload` and existing `getSettings`, `callWithFallback`, `saveImage`, and `withDb`. Store ordered source names in `source_image` and force one output.

- [ ] **Step 4: Run route and full tests**

Run:

```bash
node --test test/routes.test.js
npm test
node --check server/index.js
node --check server/reference.js
```

Expected: all tests and syntax checks pass.

### Task 4: Documentation, Deployment, and Verification

**Files:**
- Modify: `README.md`
- Runtime: `/opt/ai-image-app`, PM2 process `ai-image-app`

- [ ] **Step 1: Document the feature and endpoint**

Add the reference-image workflow, 16-image limit, ordering explanation, and `/api/images/reference` to README.

- [ ] **Step 2: Run final local verification**

Run `npm test`, `npm run build`, and syntax checks. Expected: all pass.

- [ ] **Step 3: Back up and deploy changed files**

Create a timestamped backup under `/opt/backups`, upload the new helpers, page, tests, route/navigation changes, README, and built assets, then run `pm2 restart ai-image-app --update-env`.

- [ ] **Step 4: Verify deployed route and page**

Confirm PM2 is online, `/` returns HTTP 200, authenticated reference generation accepts ordered files, and `/api/images/transform` remains HTTP 404.

- [ ] **Step 5: Commit and push**

Review `git status`, `git diff`, and recent history. Commit only intended files with:

```bash
git commit -m "feat: add reference image generation"
git push origin master
```
