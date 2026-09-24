# Phase 58 Hotfix — Monaco AMD Loader Conflict

## Problem
The Code Studio UI reported:

`Uncaught Error: Can only have one anonymous define call per script file`

The page initialized Monaco's AMD `loader.js` before UMD dependencies (`jszip`, `lightning-fs`, and `isomorphic-git`). Monaco's AMD loader can intercept anonymous `define()` calls from later-loaded libraries, producing this error.

## Fix
1. Removed the Monaco loader from the document `<head>`.
2. Loaded the UMD dependencies first.
3. Loaded Monaco's AMD loader only after those dependencies.
4. Loaded `app.js` after Monaco so `require()` is available when `CodeStudio.init()` calls `loadMonaco()`.
5. Updated the generated service-worker precache revision for `index.html` so an old cached HTML shell does not reintroduce the broken script order.

## Verification
- `node --check src/app.js`: PASS
- `node --check src/sw.js`: PASS
- Script-order assertion: PASS
- Service-worker `index.html` revision matches current file MD5: PASS
- Chromium headless smoke load: the reported anonymous-define error was not observed.

## Limitation
This environment does not reproduce the user's exact mobile browser/PWA cache state, so final verification should include a production/PWA cache refresh and a real device reload. No claim is made that a live production device was tested here.
