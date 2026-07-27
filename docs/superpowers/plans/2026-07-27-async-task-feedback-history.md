# Async Task Feedback and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return image submissions immediately, expose real execution feedback, and present history as compact task lists with on-demand previews and direct downloads.

**Architecture:** Introduce one in-memory job registry shared by generation, edit, reference, and batch workflows, with coarse progress persisted into existing history records. Extend upstream callbacks through async task polling, then use a small Vue polling helper across workflow and history pages.

**Tech Stack:** Node.js, Express, Vue 3, Axios, JSON persistence, Node.js test runner, Vite, PM2

---

### Task 1: Job Registry and Status Events

**Files:**
- Create: `server/jobs.js`
- Create: `test/jobs.test.js`
- Modify: `server/utils.js`
- Modify: `test/poll-result.test.js`

- [ ] Write failing tests for user-owned jobs, status updates, poll counts, terminal states, cleanup, and async poll status events.
- [ ] Run `node --test test/jobs.test.js test/poll-result.test.js` and verify failures are caused by missing job APIs/events.
- [ ] Implement `createJob`, `getJob`, `updateJob`, `completeJob`, `failJob`, and bounded cleanup in `server/jobs.js`.
- [ ] Pass `onStatus` into `callImageApi` and `pollAsyncTask`; emit `poll` before each GET with count and current status.
- [ ] Re-run focused tests and verify they pass.

### Task 2: Async Single-Task Routes

**Files:**
- Modify: `server/index.js`
- Modify: `test/routes.test.js`
- Create: `test/task-errors.test.js`

- [ ] Add failing route/source tests for generate/edit/reference submission routes, `GET /api/images/tasks/:jobId`, job ownership, and common error descriptions.
- [ ] Add a shared progress-to-history updater and safe history record updater.
- [ ] Make each submission route validate input, create history/job state, return `{ jobId }`, and execute the provider call in a detached promise.
- [ ] Map provider callbacks to queued/calling/retry/fallback/poll/saving/success/failed phases.
- [ ] Add startup recovery that marks persisted `running` records as `interrupted`.
- [ ] Run route, task, and complete test suites plus server syntax checks.

### Task 3: Frontend Task Polling

**Files:**
- Create: `src/task-feedback.js`
- Create: `test/task-feedback.test.js`
- Modify: `src/views/Generate.vue`
- Modify: `src/views/EditImage.vue`
- Modify: `src/views/ReferenceGenerate.vue`
- Modify: `src/views/BatchEdit.vue`

- [ ] Write failing tests for elapsed formatting, Chinese error descriptions, submission messages, polling URL construction, and session storage keys.
- [ ] Implement framework-neutral feedback helpers.
- [ ] Update Generate, Edit Image, and Reference Generate to submit for `jobId`, store it, poll every two seconds, restore on mount, and stop on terminal status/unmount.
- [ ] Replace fixed loading text with task ID, phase, progress text, attempt, poll count, provider, and elapsed seconds.
- [ ] Preserve existing success preview and all download controls.
- [ ] Add batch submission acknowledgement and aggregate query count without changing per-file progress.
- [ ] Run frontend helper tests and `npm run build`.

### Task 4: Lightweight History Lists

**Files:**
- Modify: `src/views/History.vue`
- Modify: `src/components/RecordCard.vue`
- Create: `test/history-layout.test.js`

- [ ] Write a failing source regression test requiring two list regions, no row `<img>`, status metadata, preview modal, direct download links, and active refresh.
- [ ] Change `RecordCard` into a compact row that emits preview and shows status, dimensions, quality, format, timestamps, progress, elapsed duration, and translated errors.
- [ ] Add a modal in History that loads result URLs only when opened and supports previous/next for multiple results.
- [ ] Add direct download controls without rendering thumbnails.
- [ ] Poll history while running/interrupted state reconciliation is needed; stop on unmount.
- [ ] Run history test and production build.

### Task 5: Review and Local Verification

**Files:**
- All files changed above

- [ ] Run `npm test`, `npm run build`, `node --check server/index.js`, `node --check server/jobs.js`, and `node --check server/utils.js`.
- [ ] Run `git diff --check`, review all diffs, and request a focused code review for job ownership, races, persistence, timer cleanup, and image download behavior.
- [ ] Fix critical/important findings and repeat full verification.
- [ ] Commit with `feat: add async image task feedback` and push `master`.

### Task 6: Production Deployment

**Runtime:**
- Server: `<server-ip>`
- App: `/opt/ai-image-app`
- Data: `/opt/ai-image-app-data`
- PM2: `ai-image-app`
- Port: `3003`

- [ ] Back up server source, dist, and data JSON without copying API keys locally.
- [ ] Deploy changed source and built assets while preserving `.env`, data, uploads, and node modules.
- [ ] Restart `ai-image-app` and verify PM2 is online with no new startup errors.
- [ ] Submit an authenticated low-cost task, verify immediate `jobId`, real status polling, terminal result, history list entry, preview, and direct download.
- [ ] Verify `/api/images/transform` remains 404 and public workflow/history routes return 200.
