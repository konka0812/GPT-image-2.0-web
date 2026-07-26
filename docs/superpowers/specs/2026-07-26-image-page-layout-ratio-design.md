# Image Page Layout Ratio Design

## Goal

Give image workflow controls more horizontal space by changing the desktop split from a fixed 420px left column to a 3:2 left-right ratio.

## Scope

- Apply the new ratio to Generate, Edit Image, Batch Edit, and Reference Generate.
- Use `minmax(0,3fr) minmax(0,2fr)` at the existing `lg` breakpoint.
- Preserve each page's existing gap, height, overflow, internal controls, and result presentation.
- Preserve the current stacked mobile layout.
- Do not change Login, History, Settings, APIs, or generation behavior.

## Verification

- A source regression test confirms all four image workflow pages use the shared 3:2 grid declaration and no longer use the fixed `420px` declaration.
- The full test suite and production build pass.
- The four deployed SPA routes return HTTP 200.
