# Task Polling and Result Display Design

## Goal

Reduce unnecessary task polling for long image jobs and make single generated results use the full result panel.

## Polling

- Generate, Edit Image, Reference Generate, and Batch Edit query application task state every 8 seconds.
- History refreshes every 8 seconds while any record is running.
- Upstream async task polling defaults to 8 seconds and never polls faster than 8 seconds, even when `poll_after_ms` is lower.
- Upstream values above 8 seconds remain respected up to the existing 10-second cap.

## Result Display

- A single generated image fills the result panel's available width and height using `object-contain`, without cropping or stretching.
- Generate uses a one-column full-panel layout for one image and a two-column grid only for two or more images.
- Edit Image and Reference Generate remove the inner card effect around the final image while preserving full-image containment.
- Download controls remain below the result and unchanged in behavior.
- Mobile stacking remains unchanged.

## Verification

- Source tests assert all polling intervals are 8 seconds.
- Source tests assert single-image generation uses a full-panel layout and multiple images use a grid.
- Full tests and production build pass before deployment.
