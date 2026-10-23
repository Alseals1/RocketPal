# Credits

Every texture, model, and sound used in the game is listed here with its source and licence.

| Asset | File | Source | Licence | Notes |
| --- | --- | --- | --- | --- |
| Mars surface panorama, Jezero Crater | `public/textures/surfaces/mars-jezero-4096.jpg`, `public/textures/surfaces/mars-jezero-2048.jpg` | **PIA24264**, "Mastcam-Z's First 360-Degree Panorama", NASA's Perseverance rover, Sol 3 (Feb 21, 2021), 142 images stitched. Credit line: **NASA/JPL-Caltech/MSSS/ASU**. Page: https://science.nasa.gov/photojournal/mastcam-zs-first-360-degree-panorama/ . Original file used: `PIA24264.jpg`, 9238 x 2451 px, 2,729,297 bytes, SHA-256 `2b9e68c713700bc713dea9ce532e10bb0889061b7374575bee8a1d95791f48a2`. | NASA media usage guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/): NASA content "generally [is] not subject to copyright in the United States"; use for educational purposes (the guidelines name "computer graphical simulations") is allowed; NASA must be credited as the source (done on screen next to the photo); no NASA logo or insignia is used; nothing implies NASA endorses the game. The Photojournal page states no extra restriction. **Not yet confirmed with NASA:** the guidelines do not name games, so a human may want to ask NASA directly (202-358-1900 per the guidelines page). | Only resized and re-projected into a 360 x 180 degree sphere picture by `tools/make-panorama.mjs`; the black border rows were cut off, and the sky above and ground below (which the photo does not cover) continue the photo's own edge colours. No other editing. |
| Placeholder shapes and procedural textures | generated in code | n/a | n/a | Made in code (rocket, planets, ring, Sun glow); no credit needed. |

Software: Three.js (MIT), Howler.js (MIT), Vite (MIT).
