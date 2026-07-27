# Task Polling and Result Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poll long image tasks every eight seconds and make single results fill their available result panel.

**Architecture:** Change only existing timer constants and result layout classes/branches. Add source regression tests to keep polling and single/multi-image display behavior consistent.

**Tech Stack:** Vue 3, Tailwind CSS, Node.js, Vite

---

### Task 1: Polling Intervals

**Files:**
- Modify: `server/utils.js`
- Modify: `src/use-image-task.js`
- Modify: `src/views/BatchEdit.vue`
- Modify: `src/views/History.vue`
- Create: `test/polling-intervals.test.js`

- [ ] Write a failing source test asserting 8000ms application timers and an 8000ms minimum upstream interval.
- [ ] Replace 2000ms, 1500ms, 3000ms, and the upstream 1000ms minimum with 8000ms.
- [ ] Run focused and full tests.

### Task 2: Full-Panel Single Results

**Files:**
- Modify: `src/views/Generate.vue`
- Modify: `src/views/EditImage.vue`
- Modify: `src/views/ReferenceGenerate.vue`
- Create: `test/result-display.test.js`

- [ ] Write a failing source test for one-image full-panel display and multi-image grid behavior.
- [ ] Branch Generate result layout by image count and remove the inner-card visual treatment for final images.
- [ ] Keep `object-contain` and all download controls.
- [ ] Run `npm test`, `npm run build`, syntax checks, and `git diff --check`.
- [ ] Commit, push, back up production, deploy, restart PM2, and verify workflow routes.
