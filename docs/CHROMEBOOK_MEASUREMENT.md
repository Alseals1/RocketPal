# Measure Rocket Pals on a Chromebook

A guide for one person, one sitting, about 45 minutes. It gives numbers for how the game runs on a real school Chromebook: frame rate, the freeze when a landing photo appears, memory, read-aloud, and touch. The same steps are repeated at later milestones (M1, M5, M8, M9), so the numbers can be compared.

Write every number in the tables in [PROGRESS.md](PROGRESS.md), under "Chromebook measurements". **Never write a guess.** If you could not measure something, write "could not measure: <why>".

Why this matters: nothing has ever been measured on the target device. The GPU costs in `docs/PROJECT_AUDIT.md` are estimates. The target is 30 or more frames per second (fps) and a landing freeze under 250 ms ([DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md), M1).

## 1. What you need

- The Chromebook, with the charger plugged in. Write down if it ran on battery.
- A Mac with this repo, on the same Wi-Fi as the Chromebook.
- All other tabs and apps on the Chromebook closed.
- Optional: a child (ages 8 to 10) to try the controls in step 10.

## 2. Serve the game

On the Mac, in the repo folder:

```sh
npm ci
npm run build
npm run preview -- --host
```

It prints a "Network:" address, such as `http://192.168.1.20:4173/`. Open that address in Chrome on the Chromebook.

- This is the real production build. **Do not use `npm run dev`:** it is slower and does not match what children get.
- If the school network stops the Chromebook from reaching the Mac, use a home network or a phone hotspot for both.
- A plain `http://` address on a network is not a "secure context", so Chrome hides `navigator.deviceMemory`. The game then chooses its starting quality from the CPU core count only (`src/quality/quality.ts`). The device snippet in step 4 prints `secure`; write it down.

## 3. Open the console

Press `Ctrl+Shift+J`.

If it does not open (school policy), DevTools is blocked. Then:

- Skip every snippet. Do these steps by hand: memory (step 8, Task manager), read-aloud (step 9, with a stopwatch) and touch (step 10).
- Write "DevTools blocked" in the Device table, write "could not measure: DevTools blocked" in the frame rate and landing freeze tables, and post that on issue #31. Do not try to get around the block.

## 4. Device facts

Write down:

- The model (Settings > About ChromeOS, or the label underneath).
- The first lines of `chrome://version`: the Chrome and ChromeOS versions. If `chrome://` pages are blocked, use Settings > About ChromeOS.

Then paste this into the console and copy the table it prints into the Device table in PROGRESS.md.

```js
(() => { const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); const info = gl && gl.getExtension('WEBGL_debug_renderer_info'); const r = { secure: isSecureContext, deviceMemoryGB: navigator.deviceMemory, cores: navigator.hardwareConcurrency, pixelRatio: devicePixelRatio, screen: `${screen.width}x${screen.height}`, window: `${innerWidth}x${innerHeight}`, maxTexture: gl && gl.getParameter(gl.MAX_TEXTURE_SIZE), gpu: gl && gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER), coarsePointer: matchMedia('(pointer: coarse)').matches, anyCoarsePointer: matchMedia('(any-pointer: coarse)').matches }; console.table(r); return r; })();
```

If `maxTexture` is below 4096, the game always uses the small 2048 photos on this device. Then the 4096 columns in steps 7 and 8 are "not possible on this device".

## 5. Frame rate

Do this on three pages: `/` (the game picks the quality), `/?quality=high` and `/?quality=low`.

**Do not measure on a `?debug` page.** `?debug` makes the game keep an extra copy of every picture (`preserveDrawingBuffer`, `src/scene/spaceScene.ts:65`), which can slow the very graphics chips we are measuring. These snippets time the browser's own frames instead, so they see what a child sees.

For each page:

1. Open the page and paste the timer (once per page load):

   ```js
   window.rpResults ??= []; window.measure = (label, seconds = 20, delay = 5) => { console.log(`"${label}" starts in ${delay} s and runs ${seconds} s. Close DevTools now (Ctrl+Shift+J).`); setTimeout(() => { const gaps = []; let last = performance.now(); const end = last + seconds * 1000; const step = (now) => { gaps.push(now - last); last = now; if (now < end) { requestAnimationFrame(step); return; } const s = [...gaps].sort((a, b) => a - b); const at = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; rpResults.push({ label, page: location.search || '(auto)', frames: gaps.length, avgFps: +(gaps.length / seconds).toFixed(1), medianFps: +(1000 / at(0.5)).toFixed(1), slowFps: +(1000 / at(0.95)).toFixed(1), longestMs: Math.round(s[s.length - 1]) }); console.table(rpResults); }; requestAnimationFrame(step); }, delay * 1000); };
   ```

2. **Idle near Earth.** Press "Where to?", pick Earth, press "Autopilot: fly me there!". The rocket lands. Press "Back to space". Then run `measure('idle near Earth', 20, 5)`, close DevTools, and keep your hands off the keyboard and touchpad for 20 seconds.
3. **Boosting.** Reopen DevTools and run `measure('boosting', 10, 5)`. Close DevTools, click the game once, and hold Space for the whole 10 seconds.
4. **Autopilot to Neptune.** Reopen DevTools and run `measure('autopilot to Neptune', 30, 8)`. Close DevTools, pick Neptune in "Where to?", and press Autopilot.
5. Reopen DevTools and run `console.table(rpResults)`. Copy `medianFps`, `slowFps` and `longestMs` for each row into the Frame rate table.

What the columns mean:

- `medianFps`: the typical frame rate. This is the number to compare with 30.
- `slowFps`: the speed of the slowest 1 frame in 20. A low number means stutter.
- `longestMs`: the worst single hitch, in milliseconds.

DevTools stays closed while measuring because an open console costs frames and makes the game window smaller. Keep the game tab in front: a hidden tab runs slower and gives wrong numbers.

## 6. Which quality the game picks

Open `/?debug=1`, fly around for 30 seconds (include some boosting), then run:

```js
rocketPals.getQuality()
```

Write the answer ("high" or "low") under the frame rate table. The game starts on "high" unless the device has 2 GB of memory or less, or 2 or fewer CPU cores. It then drops to "low" when the middle frame time stays under 40 fps, and never goes back up. Do not use this page's frame rate: `?debug` keeps an extra copy of each picture (see step 5).

## 7. Landing freeze

This is how long the game stops when a landing photo appears. Do it on `/?quality=high` (the 4096 photos) and on `/?quality=low` (the 2048 photos). Reload each page first, so the photos are not already saved in the browser. (A second landing in the same world, without a reload, uses a saved photo and is not a fair test.)

On each page:

1. Paste:

   ```js
   window.rpLong = []; (() => { const type = PerformanceObserver.supportedEntryTypes.includes('long-animation-frame') ? 'long-animation-frame' : 'longtask'; new PerformanceObserver((list) => list.getEntries().forEach((e) => rpLong.push({ atSeconds: +(e.startTime / 1000).toFixed(1), ms: Math.round(e.duration) }))).observe({ type }); console.log(`Watching ${type}. Land now, then run: console.table(rpLong.filter((e) => e.ms > 100))`); })();
   ```

2. Close DevTools. Pick Mars, press Autopilot, and wait until the photo shows.
3. Reopen DevTools and run `console.table(rpLong.filter((e) => e.ms > 100))`. Record the biggest `ms` near the end of the list (the landing). Write it in the Landing freeze table, Mars row.
4. Press "Back to space". Run the paste in step 1 again (it clears the list), close DevTools, pick Earth, press Autopilot, wait for the photo, reopen DevTools and run the same `console.table` line. Record the biggest `ms` in the Earth row.
5. In the Visible? column write yes or no: did you see the picture freeze?

Long frames are a stand-in for the freeze. Decoding and uploading a photo can be split over two frames, so write the biggest entry, and say in Visible? what you saw. A freeze over 500 ms goes to #31 (see step 11).

## 8. Memory

Use `/?quality=high`. Open the Task manager (`Search+Esc`, or the three-dot menu > More tools > Task manager). Right-click a column header and turn on "GPU memory".

Write down the game tab's "Memory footprint" and "GPU memory", and the "GPU Process" row's memory, at five points. Wait 5 seconds at each point before reading:

1. In space, after the page has loaded.
2. Landed on Mars.
3. Back in space after Mars.
4. Landed on Earth.
5. Back in space after Earth.

If you have time, do it again on `/?quality=low`.

What to look for: GPU memory that does not go down after leaving a world.

## 9. Read-aloud

Paste this. It lists the voices after one second, and prints how long it takes for reading to start.

```js
(() => { const speak = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = (u) => { const t = performance.now(); u.addEventListener('start', () => console.log(`Read-aloud started after ${Math.round(performance.now() - t)} ms`)); return speak(u); }; setTimeout(() => console.table(speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang, local: v.localService }))), 1000); })();
```

Record the voice list: how many voices, which English ones, and whether they are local or not. Then land on Mars, tap a glowing dot, and tap Listen. Record:

- Did it speak?
- The start time the console printed.
- How it sounded (clear, robotic, too quiet).

If nothing speaks within about 2.5 seconds, the game gives up (`src/audio/speech.ts`, `START_TIMEOUT_MS`). Write down what the button did.

Without DevTools: time it with a stopwatch, from the tap to the first word.

## 10. Touchpad and touch

If you can, do this with a child. On `/`:

- Can you steer with the touchpad alone, with no keyboard?
- On a touchscreen model, do the on-screen controls appear by themselves? If not, try `/?touch`.
- Can a finger and the touchpad hit all of these: the "Where to?" picker, Autopilot, glowing dots, Listen, "Back to space", and the quiz answers?
- Can you drag to look around the photo?

Write yes or no for each, and one line about what got in the way.

## 11. After measuring

1. Fill in the tables in [PROGRESS.md](PROGRESS.md). Mark anything you did not measure "could not measure: <why>". **Never fill a cell with an estimate.**
2. Post a note on issue #31 (Chromebook readiness) for every row where the median is **under 30 fps** and every landing freeze **over 500 ms**. Copy the row into the note. If DevTools was blocked, post that too.
3. List the notes you posted on the "Notes posted on #31" line in PROGRESS.md.
4. Link the filled-in tables from issue #28.
