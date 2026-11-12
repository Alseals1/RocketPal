# How the Chromebook is measured

Date: 2026-11-11. Decided by the Implement agent for issue #28, following the approved plan.

## What was decided
1. **Frame rate comes from the browser's own frame timing, on the production build, without `?debug`.** A console snippet records the gap between `requestAnimationFrame` calls and reports the median fps, the slow fps (the slowest 1 frame in 20) and the longest gap. The median is the number compared with the 30 fps target.
2. **`?debug=1` is used for one thing only:** reading `rocketPals.getQuality()` to learn which quality the game picked by itself. Its frame rate is never used.
3. **The game is served from a Mac with `npm run build` and `npm run preview -- --host`**, and opened on the Chromebook by the LAN address. There is no hosted build.
4. **The landing freeze is read from long-frame entries** (`long-animation-frame`, or `longtask` where the first is missing), with a note on whether the freeze was visible. The 500 ms line sends a miss to #31; the M1 target is under 250 ms.
5. **No on-screen fps readout in the game for now.** If a school blocks DevTools, the person records that on #31 and it becomes a #31 item.
6. **Numbers come only from a person.** The guide and the empty tables are agent work. No cell is filled with an estimate, by anyone.
7. **The guide is its own file** (`docs/CHROMEBOOK_MEASUREMENT.md`) and the results are in `docs/PROGRESS.md`, because the same steps are repeated at M1, M5, M8 and M9.

## Why
- `?debug` turns on `preserveDrawingBuffer` in the renderer (`src/scene/spaceScene.ts:65`), which keeps an extra copy of every picture and can lower the frame rate on the very graphics chips we want to measure. Timing the browser's frames sees what a child sees.
- The production build is what children get. `npm run dev` is slower and different.
- A plain `http://` LAN address is not a secure context, so `navigator.deviceMemory` is hidden and the game's start-quality rule (`src/quality/quality.ts`) only sees the CPU core count. This is recorded in the Device table (`secure`). The risk is low: Chromebooks usually report 4 GB or more, which does not trigger the 2 GB rule.
- The audit's GPU costs are estimates. Decisions about quality and photo sizes should rest on numbers from the target device.
- Long frames are a stand-in for the freeze: decoding and uploading a photo can split over two frames. The guide asks for the biggest entry plus what the person saw, which is good enough to compare 4096 against 2048 and to compare with 500 ms and 250 ms.

## Alternatives
- **`window.rocketPals.getFps()`:** needs `?debug`, which changes what is measured (see above).
- **An on-screen fps and long-frame readout in the game:** works even if DevTools is blocked, but it is new UI and code that the architecture does not list (`docs/TECHNICAL_ARCHITECTURE.md` gives this measurement to a person). It needs its own plan.
- **The checklist only in `docs/PROGRESS.md`:** PROGRESS is a status page; the guide is reused at four later milestones.
- **An agent estimating from the audit or from a desktop run:** rejected. The issue exists because nothing has been measured.

## Follow-ups for a person
- Measure with the guide and get the numbers into `docs/PROGRESS.md` (recommended: paste the filled tables in a comment on #28 and send the issue back to implement; or commit them to the PR branch).
- Post a note on #31 for every median under 30 fps and every freeze over 500 ms.
