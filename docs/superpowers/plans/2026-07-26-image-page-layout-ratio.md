# Image Page Layout Ratio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the four image workflow pages to a desktop 3:2 control-result layout.

**Architecture:** Replace only each page's outer desktop grid declaration. Add a source regression test to keep all four pages aligned while preserving their existing mobile stacking and internal layout.

**Tech Stack:** Vue 3, Tailwind CSS, Node.js test runner, Vite

---

### Task 1: Apply and Verify the 3:2 Layout

**Files:**
- Create: `test/image-layout.test.js`
- Modify: `src/views/Generate.vue:2`
- Modify: `src/views/EditImage.vue:2`
- Modify: `src/views/BatchEdit.vue:2`
- Modify: `src/views/ReferenceGenerate.vue:2`

- [ ] **Step 1: Write the failing regression test**

Read all four Vue files and assert each includes `lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` and excludes `lg:grid-cols-[420px_1fr]`.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test test/image-layout.test.js`

Expected: all four page assertions fail because they still use 420px.

- [ ] **Step 3: Replace the four desktop grid declarations**

Change only `lg:grid-cols-[420px_1fr]` to `lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` in all four files.

- [ ] **Step 4: Run complete verification**

Run `npm test`, `npm run build`, and `git diff --check`.

Expected: all tests pass, Vite builds, and the diff has no whitespace errors.

- [ ] **Step 5: Commit, push, and deploy**

Commit with `style: widen image workflow controls`, push `master`, back up the four production Vue files and `dist`, deploy source and built assets, restart PM2, and verify `/generate`, `/edit`, `/batch-edit`, and `/reference` return HTTP 200.
