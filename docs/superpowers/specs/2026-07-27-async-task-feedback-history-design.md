# Async Task Feedback and History Design

## Goal

Make image tasks visibly submitted and observable while they run, and turn history into a lightweight task list with on-demand full-size previews and direct downloads.

## Scope

- Convert Generate, Edit Image, and Reference Generate from browser-held requests to server-side jobs with immediate `jobId` responses.
- Keep Batch Edit asynchronous and add the same submission acknowledgement plus aggregate polling feedback.
- Preserve all existing result previews and downloads on workflow pages.
- Replace history thumbnail grids with two compact lists: generations on the left, edits/reference/batch records on the right.
- Do not load result images in history until a user opens the preview dialog or downloads a result.

## Job Lifecycle

Each job stores:

- `id`, `userId`, `kind`, `recordId`, `status`, `phase`, `progressText`
- `attempt`, `maxAttempts`, `pollCount`, `baseUrl`
- `createdAt`, `updatedAt`, `completedAt`, `images`, `error`

Submission endpoints validate input, create the history record, create an in-memory job, return `{ jobId }`, then execute in the background. Job endpoints return only jobs owned by the authenticated user.

Frontend pages poll every two seconds and display the actual phase, elapsed time, attempt counts, upstream poll count, active provider, and final error or images. The active `jobId` is stored in `sessionStorage` per workflow so a refresh resumes polling without resubmitting.

## Real Status Events

Existing retry/fallback callbacks become job updates. Upstream async polling emits a callback before each task-status request, including `pollCount` and the latest upstream status. Other phases include queued, calling provider, retry wait, provider fallback, saving images, success, and failure.

## Submission Feedback

After a successful submission response, pages show a lightweight acknowledgement containing the task ID. Buttons remain disabled while the active job runs. Validation failures do not create jobs and show inline errors.

## History

History remains split into generations and edits. Rows show status, prompt summary, dimensions, quality, format, timestamp, elapsed duration, and persisted progress/error text. Running rows refresh automatically.

Successful rows provide:

- `预览`: opens a full-screen modal; multi-image generations support previous/next navigation.
- `下载`: directly downloads the original saved image; multi-image records expose one download button per result in the modal.

No `<img>` elements are rendered in history list rows. Legacy records without job fields remain compatible.

## Persistence and Restart

History records persist coarse fields: `job_id`, `progress_text`, `phase`, `attempt`, `poll_count`, `base_url`, `started_at`, and `completed_at`. Fine-grained active job state remains in memory.

At process startup, legacy records left in `running` become `interrupted` with a clear restart message. Existing successful, failed, and old transform/reference records remain unchanged.

## Errors

History and workflow pages translate common errors:

- 401: upstream authentication rejected; verify provider/key or retry because providers may return transient 401 responses.
- 403: upstream permission or content-policy rejection.
- 413: uploaded file exceeds the route limit.
- 502: provider temporarily unavailable.
- 524/timeout: provider processing timeout; lower size/quality or retry.
- `fetch failed`: provider network connection failed.

Raw error text remains persisted for diagnostics.

## Verification

- Unit tests cover job ownership, status updates, poll event counts, error descriptions, and interrupted-record recovery.
- Route regression tests cover submission and job-status endpoints while `/api/images/transform` remains absent.
- Frontend source tests cover submission acknowledgement, job polling, session recovery, history lists without thumbnail images, modal preview, and direct download controls.
- Full tests, syntax checks, and production build pass before deployment.
