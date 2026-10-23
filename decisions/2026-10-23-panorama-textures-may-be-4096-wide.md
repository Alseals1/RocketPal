# Panorama pictures may be 4096 pixels wide

**Decided by:** the user ("Yes to both", 2026-10-23), after the main agent explained the trade-off.

## What
`CLAUDE.md` says textures are at most 2048 px. Panorama pictures (the 360 degree landing photos) may be 4096 px wide. Everything else stays at 2048. Each panorama also has a 2048 px version used in low-quality mode and on graphics cards whose texture limit is below 4096.

## Why
A 2048 px picture stretched round a whole sphere is soft. The 4096 px Mars picture is 795 kB and the 2048 px one is 243 kB; both load only when you land, so the first play stays small (the whole built game is 1.7 MB).

## Cost
A 4096 x 2048 texture is about 45 MB of video memory with mipmaps. Unproven on a school Chromebook.

## For the user to decide
`CLAUDE.md` still says "Textures at most 2048px". It is the user's file, so the main agent did not edit it. Suggested wording: "...except 360 degree panorama pictures, which may be 4096 px wide (with a 2048 px low-quality version)."
