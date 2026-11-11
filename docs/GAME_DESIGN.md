# Rocket Pal 2.0: game design document

**Status: approved by the product owner on 2026-11-11**, with all eight decisions in section 19 (see `decisions/2026-11-11-game-design-approved.md`). Nothing in it is built yet unless it says "exists today". `docs/DEVELOPMENT_ROADMAP.md` and the issues under epic #16 follow it, and it is the reference for #18 (experience contract).

The product rules in `CLAUDE.md` always win. Facts quoted in this document are examples of tone; every fact in the game is checked against a NASA page and dated before it ships.

---

## 0. The game in one page

**Pitch.** You are a young pilot with a small rocket and a robot friend, Orbit. Fly anywhere in the solar system, look out at real NASA photos, find out what makes each world special, zip through the asteroid belt, help lost probes get home, and make your rocket and astronaut your own.

**Audience.** Children aged 8-10: confident readers or near-readers, short sessions (10-20 minutes), school Chromebooks and home tablets, playing alone.

**Pillars.**

| Pillar | Promise |
| --- | --- |
| Fun | There is always something to find, and finding it feels good. |
| Education | Everything you learn is real, checked, and something you did, not only read. |
| Action | Flying takes skill when you want it to, and never punishes you. |
| Customization | Your rocket and astronaut show where you have been and what you have done. |

**Design rules** (from `CLAUDE.md` and `decisions/2026-11-11-rocket-pal-2-game-rules.md`):
1. **Nothing ends in failure.** Wrong answers never end a mission. Bumping into something bounces the rocket and costs a few seconds. You can always retry.
2. **No countdowns.** Timed challenges are stopwatches with "beat your best time".
3. **Every reward is earned in a way the kid can see.** Every lock says what opens it. Nothing is random, nothing is bought, nothing is spent, and nothing goes down.
4. **Healthy engagement only.** No ads, purchases, loot boxes, streaks, daily logins, energy or lives, leaderboards, push notifications, accounts or data collection.
5. **Short words, friendly tone, nothing scary.** Space is amazing, never dangerous-scary.
6. **Everyone can play.** Keyboard, touch and mouse; big targets; read-aloud; text size; reduced motion; colourblind-safe.
7. **Free to explore.** Every world can be reached from the first minute. Missions suggest; they never lock a destination.

**Three kinds of progress, and only three.**

| | What it is | How you get it | What it does |
| --- | --- | --- | --- |
| **Stars** | Mastery: up to 3 on each world and each challenge course | Finishing things, then doing them well | Unlock specific rewards ("3 stars on Mars") |
| **XP** | Effort and curiosity | Almost everything you do | Raises your pilot rank; ranks unlock reward sets and harder courses |
| **Patches** | Achievements | Named goals, all listed with their conditions | Collected on your patch board; worn on your astronaut's suit |

There are no coins. You never spend anything, so nothing can be lost, wasted or ground for.

**What exists today (the base we build on):** free 3D flight with strong assists and docking that cannot fail, autopilot, real-distance HUD, 10 worlds to fly to, full landings on Earth (ISS window) and Mars (360 degree panorama) with fact dots, "find 3" missions, 3-question quizzes, 3 stars per world, read-aloud, text size and reduced motion settings, a Blender rocket and Orbit portraits.

---

## 1. Core gameplay loop

### The session loop (one trip, 3-6 minutes)

```
Pick a place on the Star Map
   → Fly there (collect capsules on the way, or take autopilot)
   → Arrive: land (Earth, Mars, later the Moon) or a fly-by view (every other world)
   → Explore: find the glowing dots and read or hear each fact
   → Mission: "Find 3 things", then the quiz or postcard question
   → Earn: stars, XP, journal pages, sometimes a patch or an unlock
   → Orbit suggests what next (a Grand Tour step, a challenge, an unlock you are close to)
   → Back to the Star Map
```

### The long loop (over many sessions)

Rank up → unlock new paint, decals and harder courses → show them off on the next trip → fill the Space Journal and the patch board → finish the Grand Tour chapters → come back for personal bests, missing stars and new content.

### A first 15-minute session

| Minute | What happens |
| --- | --- |
| 0-1 | Title screen. First time only: pick a call sign from a list and a rocket colour. Orbit says hello. |
| 1-3 | **First flight** (tutorial): fly to the Moon with on-screen hints for steer and boost. Collect two capsules on the way. Arrive at the Moon fly-by view, find 3 dots. |
| 3-4 | Postcard question. First star, first patch ("First Flight"), rank-up to Junior Pilot. Unlocks a second rocket colour. |
| 4-9 | Orbit suggests Earth (Grand Tour chapter 1). Land, find 3 things out of the station window, take the quiz. |
| 9-13 | Orbit: "Want to fly through the asteroid belt?" Asteroid Belt Run, Cadet course. Personal best saved. |
| 13-15 | Open the Hangar, put on the new colour, see the rocket spin. Back to the Star Map: 4 stars shown, the next chapter step glowing. |

### How it connects

Everything a kid does feeds the same three progress kinds, and every reward shows up somewhere visible: on the rocket, on the astronaut, on the Star Map, in the Journal or on the patch board.

---

## 2. Main menu and navigation

**Rule:** any screen is at most two taps from the Star Map, and Back always works (button, Escape, or the browser's Back).

### Screens

```
Title ──► First flight (first time only)
  │
  ▼
Star Map ◄──────────────► Flying (cockpit HUD)
  │  ▲                        │
  │  └── Arrive ◄─────────────┘
  │        ├─ Landing (Earth, Mars, later Moon)
  │        └─ Fly-by view (all other worlds)
  │
  └─ Mission Control (menu button, any time; the game pauses)
       ├─ Missions     (Grand Tour, side missions)
       ├─ Hangar       (rocket and astronaut)
       ├─ Journal      (fact pages, capsule facts, spacecraft cards)
       ├─ Patches      (achievements)
       └─ Settings     (text size, motion, sound, assists, controls)
```

### Title screen
- **What the player does:** one big **Fly!** button (continues where they were), plus Hangar, Journal and Settings.
- **What the player learns:** nothing yet; it should take two seconds to get playing.
- **How the player earns rewards:** none.
- **How it connects:** the first time, it leads into First flight; afterwards straight to the Star Map.

### Star Map (replaces today's "Where to?" list)
- **What the player does:** sees the Sun, the planets, the Moon and the asteroid belt in order, each with its stars (0-3), a glow on the next Grand Tour step and a badge on challenges. Tap one to set course. A toggle shows real distances from the Sun.
- **What the player learns:** the order of the worlds and how far apart they really are.
- **How the player earns rewards:** no rewards here; it is where rewards are shown.
- **How it connects:** the hub. Every trip starts here, and stars and chapter progress are always visible here.

### Cockpit HUD (flying)
- **What the player does:** flies; reads distance to go, light time and speed; sees capsules ahead; opens Mission Control.
- **What the player learns:** real distances and light time (exists today), and that our rocket is pretend-fast (see 6.3).
- **How the player earns rewards:** capsules (section 11).
- **How it connects:** the same HUD is used in action challenges, with a stopwatch added.

### Mission Control
- **What the player does:** opens a panel with five tabs. The game pauses behind it.
- **What the player learns:** where to find everything.
- **How the player earns rewards:** none directly; it is where rewards are equipped and reviewed.
- **How it connects:** the home of the Hangar, Journal and Patches.

---

## 3. Player progression

### Pilot ranks
Eight ranks from XP. They only go up. Starting thresholds, to tune in playtests:

| Rank | XP | Unlocks (examples) |
| --- | --- | --- |
| 1. Cadet | 0 | Starter rocket, 2 colours |
| 2. Junior Pilot | 60 | 2 more colours, first decal |
| 3. Pilot | 160 | Pilot courses in challenges, exhaust colours |
| 4. Navigator | 300 | More decals |
| 5. Explorer | 480 | Ace courses, explorer paint set |
| 6. Senior Explorer | 700 | Special exhaust trails |
| 7. Commander | 960 | Commander decal set |
| 8. Star Captain | 1,260 | Gold trim, Star Captain patch |

- **What the player does:** plays; the rank bar fills on every reward screen, and Orbit celebrates a rank-up.
- **What the player learns:** nothing new by itself; ranks pace the unlocks.
- **How the player earns rewards:** XP (section 10). Doing everything in the MVP once comes to about 1,150 XP (rank 7, Commander); Phase 2 content takes a kid to Star Captain.
- **How it connects:** ranks unlock Hangar items and harder challenge courses, and quiz questions get a little harder at higher ranks (section 13).

### The Grand Tour (main missions, section 9)
Four chapters that give the game a story arc without locking anything.

### Mastery
Stars per world and per course. Three stars everywhere is the long-term goal for kids who love completing things.

---

## 4. Rocket customization

The rocket model already has a separate `Trim` material and `Flame` object, so the first options cost no new modelling.

| Slot | MVP | Phase 2 | Phase 3 |
| --- | --- | --- | --- |
| Paint (trim colour) | 8 colours | | Patterns (stripes, checks) |
| Decal (on the hull) | 6 decals | 6 more | |
| Exhaust (flame colour) | 4 colours | Trails | |
| Parts (nose, fins) | | | 3 shapes each (new Blender variants) |
| Gear (see below) | | Telescope, Radio dish | Spectrometer, Magnetometer |

### Paint, decals and exhaust
- **What the player does:** in the Hangar, picks a slot, sees the rocket spin with the choice, and equips it. Locked items show their condition ("Reach Navigator", "3 stars on Saturn").
- **What the player learns:** every unlock card has one fact. A Saturn decal: "Saturn's rings are mostly ice." Exhaust colours: "Different gases glow different colours."
- **How the player earns rewards:** ranks unlock sets; specific stars or patches unlock themed items (a Mars-red paint for 3 stars on Mars).
- **How it connects:** the rocket is on screen on every trip and in every challenge, so it shows off progress all the time.

### Gear (Phase 2 onwards)
Gear changes **what you can see and learn, never whether you can win.** It never makes a challenge easier; assists are a setting, free for everyone.
- **Telescope** (Phase 2). *Does:* zoom in on a fly-by photo to find a hidden fourth dot. *Learns:* telescopes and spacecraft cameras show detail our eyes cannot. *Earns:* unlocked by finishing Grand Tour chapter 2; the hidden dots give journal pages. *Connects:* adds a reason to revisit every fly-by world.
- **Radio dish** (Phase 2). *Does:* unlocks the Light-Speed Messenger mini-game (section 8). *Learns:* radio travels at light speed, so messages to far probes take hours. *Earns:* chapter 3. *Connects:* builds on the HUD's light-time line.
- **Spectrometer, Magnetometer** (Phase 3). *Does:* show what a world's air is made of; show auroras on Earth and Jupiter. *Learns:* how scientists study worlds from far away. *Earns:* chapter 4 and patches. *Connects:* more hidden dots and journal pages.

---

## 5. Astronaut customization (Phase 2)

Needs the astronaut model from `ASSETS.md` (2,500 triangles). The astronaut appears in the Hangar, next to Orbit on landing and fly-by screens, and waving at the cockpit window during the reward screen. There is no walking around on surfaces (see section 17).

| Slot | Options |
| --- | --- |
| Suit colour | 6 (white first, with a fact about why real suits are white) |
| Visor tint | 4 (gold, with a fact about why real visors are gold-coated) |
| Patch on the chest | Any earned patch |
| Backpack | 4 shapes |
| Helmet light | 4 colours |

- **What the player does:** dresses the astronaut in the Hangar, next to the rocket.
- **What the player learns:** each item has a real fact about spacesuits and why they are built that way.
- **How the player earns rewards:** the same ranks, stars and patches as the rocket. Earned patches can be worn, which turns achievements into something visible.
- **How it connects:** the astronaut is the star of the Weigh-in mini-game (section 8) and the reward screen.

**Safety:** no faces from photos, no free-text names. The call sign is picked from a list of friendly words ("Comet Fox", "Nova Seven").

---

## 6. Planet exploration

### 6.1 Arrival views

| World | View | Status |
| --- | --- | --- |
| Earth | ISS window, astronaut photo, 6 dots | Exists today |
| Mars | Perseverance 360 degree panorama, 5 dots | Exists today |
| Moon | Fly-by view in MVP; Apollo panorama landing in Phase 2 | New |
| Sun, Mercury, Venus, Jupiter, Saturn, Uranus, Neptune | **Fly-by view**: a real spacecraft photo seen through the cockpit window, 3 dots | New (MVP) |
| Asteroid belt | The Asteroid Belt Run (section 7) | New (MVP) |

The fly-by view reuses the window view built for Earth, with a photo from the mission that visited: the Solar Dynamics Observatory (Sun), MESSENGER (Mercury), Magellan or another NASA mission (Venus), Juno (Jupiter), Cassini (Saturn), Voyager 2 (Uranus, Neptune). Each photo's licence is recorded in `CREDITS.md`. The words say "flying past", never "landed", on the Sun and the giant planets.

### 6.2 Finding dots (exists today, extended)
- **What the player does:** looks around the photo and taps glowing dots to open fact cards (with Listen).
- **What the player learns:** one real thing per dot, tied to what is in the photo (the rim of Jezero crater, Jupiter's Great Red Spot).
- **How the player earns rewards:** 5 XP per new dot; each new dot is stamped into the Journal. Found dots are now **remembered** between visits.
- **How it connects:** dots feed missions ("find 3"), quiz questions (answers come from dots), Photo Detective (section 8) and the Journal.

### 6.3 The flight between worlds
- **What the player does:** flies by hand or by autopilot, and steers through floating **capsules** placed along the route (2-4 per trip, never blocking the path).
- **What the player learns:** each capsule holds a one-line fact about the journey ("Light from the Sun takes about 8 minutes to reach Earth"). The HUD says plainly that our rocket is pretend and faster than light, and gives a real comparison ("New Horizons took 9.5 years to reach Pluto").
- **How the player earns rewards:** 3 XP per new capsule, and capsule facts fill a Journal section.
- **How it connects:** gives flights something to do, and makes steering matter a little without ever being needed. Autopilot flies past capsules, so a kid who just wants to get there loses nothing.

---

## 7. Action challenges

Every challenge follows the same rules:
- A count-up stopwatch and your personal best. No countdown, no "too slow".
- Bumping bounces the rocket with a soft "boing" and adds 2 seconds. You always finish.
- Three stars: **finish**, **collect all the crystals**, **smooth flying** (3 bumps or fewer). Time is never a star; it is only your own best.
- Three courses: **Cadet** (wide gaps, slow, full assists), **Pilot** (unlocked at the Pilot rank or after 2 Cadet stars), **Ace** (Explorer rank, or 2 Pilot stars).
- A **Skip** or **Leave** button is always there, and leaving keeps what you collected.

### Asteroid Belt Run (MVP)
- **What the player does:** flies a winding path through drifting, friendly-looking asteroids between Mars and Jupiter, collecting 5 crystals on the way.
- **What the player learns:** a fact gate at the start and end. The real asteroid belt is mostly empty space (spacecraft fly through it safely); asteroids are left-over pieces from when the planets formed; the biggest one, Ceres, is a dwarf planet. The game says honestly that our course is packed much closer than the real belt.
- **How the player earns rewards:** 30 XP for the first finish of each course, 10 XP per star, a patch for each course, and a decal for 3 stars on Ace.
- **How it connects:** the asteroid belt is a place on the Star Map, it is a Grand Tour chapter 3 step, and it uses the same flight model with a weaker assist.

### Ring Gate Runs (Phase 2)
- **What the player does:** flies through a chain of glowing gates on a real route ("Earth to Mars Express"). The gates guide the path.
- **What the player learns:** the order and distances of worlds (the HUD shows real kilometres between gates).
- **How the player earns rewards:** the same star rules; personal bests per route.
- **How it connects:** reuses capsules' placement code and the normal HUD. One route per Grand Tour chapter.

### Rescue missions (Phase 2)
- **What the player does:** finds a lost weather balloon, a drifting probe or a stranded robot pal near a world, docks with it (docking cannot fail), and tows it home. While towing, the rocket speeds up and slows down more gently.
- **What the player learns:** basic physics: a heavier load needs more push to speed up and to stop (mass and inertia).
- **How the player earns rewards:** 25 XP, a Helper patch line, and a thank-you postcard in the Journal.
- **How it connects:** side missions (section 9); uses docking and autopilot targeting that exist today.

### Advanced challenges (Phase 3: pick two after playtests)
- **Saturn Ring Slalom.** Weave between ice chunks in Saturn's rings. Learns: rings are made of ice and rock pieces.
- **Comet Chase.** Follow a comet around the Sun. Learns: a comet's tail always points away from the Sun.
- **Gravity Slingshot.** Aim a fly-by past Jupiter to gain speed, with a dotted preview line. Learns: real probes like Voyager used gravity assists.

---

## 8. Educational mini-games

Short (1-2 minutes), optional, no score that can go down, and always with Listen.

### Quiz and postcard questions (exists today, extended in MVP)
- **What the player does:** answers 3 questions on a full-landing world, or one postcard question on a fly-by world. Unlimited tries, a hint naming the dot with the answer.
- **What the player learns:** the facts from that world's dots, recalled.
- **How the player earns rewards:** stars (finish, and first-try bonus), 20 XP for the first finish, 10 XP for the first perfect.
- **How it connects:** questions now come from a **pool** of 6-9 per world, shuffled, with answers in a random order, so replays and the bonus star are real. Higher ranks draw harder questions (section 13).

### Photo Detective (Phase 2)
- **What the player does:** Orbit names something in the photo ("Find Perseverance's wheels!") and the kid taps where it is. A wrong tap gets a warmer or colder hint.
- **What the player learns:** to look closely at real photos and recognise features, the way scientists do.
- **How the player earns rewards:** 10 XP per world the first time, a Detective patch line.
- **How it connects:** uses the dot positions that already exist on every photo.

### Planet Lineup (Phase 2)
- **What the player does:** drags the planets into order: by distance from the Sun, then by size. "Show me" reveals the answer at any time. Nothing is scored.
- **What the player learns:** order and relative size (Jupiter is about 11 Earths across).
- **How the player earns rewards:** 15 XP and a patch the first time each order is completed.
- **How it connects:** opened from the Star Map; the planet sizes come from `planets.json`.

### Weigh-in (Phase 2, needs the astronaut)
- **What the player does:** puts the astronaut's 10 kg backpack on a scale on each world it has visited and watches the reading change.
- **What the player learns:** gravity is different on each world (that backpack would feel like about 3.8 kg on Mars).
- **How the player earns rewards:** a journal page per world weighed.
- **How it connects:** the kid's own weight is never asked for (personal data, and not a topic for this game).

### Light-Speed Messenger (Phase 2, with the Radio dish)
- **What the player does:** sends a message from Earth to a probe and guesses how long it takes. Then watches the light-speed pulse travel on the map, sped up, with the real time shown.
- **What the player learns:** even light takes time; messages to Mars take minutes, and to Neptune hours.
- **How the player earns rewards:** 10 XP per destination; guesses are never marked wrong, only "close" or "even further!".
- **How it connects:** the same light-time numbers as the HUD.

---

## 9. Main missions and side missions

### Main missions: the Grand Tour
Four chapters, told by Orbit. Each chapter is a short list of steps. Steps are suggestions shown on the Star Map; every world stays open.

| Chapter | Steps (MVP) | Theme | Reward |
| --- | --- | --- | --- |
| 1. Home and Neighbours | First flight to the Moon, Earth landing and quiz | Our home and the closest world | Patch, rocket colour |
| 2. Rocky Worlds | Mercury, Venus, Mars, and a careful look at the Sun from a safe distance | Rocky planets and our star | Patch, decal (Phase 2: Telescope) |
| 3. The Belt and the Giants | Asteroid Belt Run (Cadet), Jupiter, Saturn | Gas giants and left-over rocks | Patch, exhaust colour (Phase 2: Radio dish) |
| 4. The Ice Giants | Uranus, Neptune | The far, cold edge | Star Captain decal and a big Orbit celebration |

- **What the player does:** follows Orbit's suggestions or ignores them; any order works within a chapter.
- **What the player learns:** a guided path through the solar system from the inside out.
- **How the player earns rewards:** 50 XP and a patch per chapter, plus the chapter's unlock.
- **How it connects:** gives the free-flight game a beginning, middle and end, and points kids at content they have not seen.

### Side missions
- **"Find 3" missions** (exist today on Earth and Mars; MVP on every world).
- **Rescue missions** (Phase 2): one per chapter.
- **Orbit's requests** (Phase 2): small one-off asks shown two at a time on the Missions tab ("Can you find Saturn's biggest moon in the photo?", "Collect a capsule on the way to Venus"). Picked from those not yet done; never expire.

Each side mission: **does** a short task; **learns** one thing; **earns** 15-25 XP and sometimes a patch; **connects** by sending the kid to a world or a mini-game they have not finished. Missions live in `missions.json` and are validated like today.

---

## 10. XP and reward systems

### XP table (starting values, tuned in playtests)

| Action | First time | Again |
| --- | --- | --- |
| Find a dot | 5 | 1 |
| Collect a capsule | 3 | 1 |
| Finish a "find 3" mission | 20 | 5 |
| Finish a quiz or postcard | 20 | 5 |
| Perfect quiz (all first try) | 10 | 0 |
| Finish a challenge course | 30 | 5 |
| A challenge star | 10 | 0 |
| A new personal best | n/a | 5 |
| Finish a side mission | 15-25 | 0 |
| Finish a Grand Tour chapter | 50 | 0 |
| A mini-game, first time per world | 10-15 | 2 |

**Why first time and again:** trying new things is worth the most, so variety pays, but replaying a favourite is never worthless. There is nothing to farm for, because XP is not spent and ranks end at 8.

### The reward screen
After any mission, quiz or challenge: stars fill in, the XP bar fills (rank-up has its own celebration), new journal pages fly into the Journal icon, and any new patch or unlock is shown with its fact. Then Orbit suggests the next thing. Reduced motion shows the same screen with no movement.

### Unlock rules
- Every unlock is worked out from what has been earned (ranks, stars, patches). It is never stored as a purchase, so a save from another window can never lose it.
- Every locked item shows exactly what opens it.
- There are no random rewards and no "mystery" boxes.

---

## 11. Collectibles

| Collectible | Phase | How you get one | What you learn | Where it shows |
| --- | --- | --- | --- | --- |
| **Fact pages** (one per dot) | MVP | Find the dot | The dot's fact | Journal, by world |
| **Capsule facts** | MVP | Fly through a capsule | A fact about the journey | Journal, "On the way" |
| **Patches** | MVP (12), Phase 2 (24) | Achievements (section 12) | Each patch names what it marks | Patch board, astronaut's chest |
| **Spacecraft cards** | Phase 2 | Visit the worlds a real mission explored | Real missions: Voyager 2, Juno, Cassini, Perseverance, Apollo | Journal, "Explorers" |
| **Hidden dots** | Phase 2 | With the Telescope on fly-by worlds | Extra detail in the photo | Journal |
| **Postcards** | Phase 2 | Rescue missions and chapter ends | A thank-you note with one fact | Journal |

- **What the player does:** opens the Journal to see pages filling in, world by world, with empty outlines for what is still out there.
- **What the player learns:** the Journal is a revision book: every fact the kid has found, with Listen.
- **How the player earns rewards:** completing a world's pages gives a patch.
- **How it connects:** the Journal is where the learning is kept, and its empty outlines point to where to go next.

---

## 12. Achievement system: mission patches

Patches are achievements with visible conditions. Never for time played, logging in, streaks or speed against others.

**MVP set (12):** First Flight; Home Sweet Home (Earth quiz); Red Planet (Mars quiz); Moon Walker (Moon postcard); Sun Watcher; Rocky Worlds (chapter 2); Belt Runner (finish Cadet); Smooth Pilot (smooth-flying star on any course); Ace Pilot (finish Ace); Giant Spotter (Jupiter and Saturn); Ice Giants (chapter 4); Grand Tour (all four chapters).

**Phase 2 adds 12:** a Detective line (Photo Detective on 3, 6 and 10 worlds); a Helper line (1, 3 and all rescues); Journal Keeper (all pages for 5 worlds); Planet Lineup (both orders); Messenger (every destination); Three-Star World (any world at 3 stars); Collector (every capsule fact); Star Captain (rank 8).

- **What the player does:** earns patches by playing, and views them on the patch board, where unearned patches show as outlines with their condition.
- **What the player learns:** each patch has a one-line fact linked to its theme.
- **How the player earns rewards:** a patch is the reward, wearable on the astronaut's suit; some also unlock a decal.
- **How it connects:** patches are the clearest list of "things you could do next".

---

## 13. Difficulty progression

Difficulty goes up by **choice and by rank, never by punishment.**

| Area | How it gets harder | How it stays kind |
| --- | --- | --- |
| Normal flights | Never. Docking always works and autopilot is always there | Capsules are optional |
| Challenges | Cadet, then Pilot, then Ace courses: tighter gaps, moving rocks, weaker assist | Cadet is always open; bumps only add seconds. After lots of bumps Orbit asks "Want a wider path?" and the kid chooses |
| Flight assists | Settings: **Full** (default), **Some**, **Little** steering help in challenges | Changing it never changes rewards |
| Questions | Each pool question has a level: 1 (what is it?), 2 (numbers and comparisons), 3 (why and how). Ranks 1-2 draw level 1-2, rank 5 and up mix in level 3 | Unlimited tries, hints, Listen. The first-try bonus is the only thing that gets harder |
| Mini-games | Planet Lineup adds size after distance; Photo Detective asks for smaller features at higher ranks | "Show me" is always there |

---

## 14. Replayability

Kids come back because there is more to find and more to show, not because they are told to.
- **Question pools** with shuffled answers: a replayed quiz is a new quiz.
- **Missing stars** are visible on the Star Map.
- **Personal bests** on every course and route.
- **Harder courses** unlock with rank.
- **The Journal and the patch board** show outlines of what is still out there.
- **Orbit's requests** offer two new small things each session.
- **Unlocks** to show off on the next trip.
- **New content in later phases:** the Moon landing, gear with hidden dots, new challenges.

Not used: daily rewards, streaks, timers that reset, "come back tomorrow" messages, notifications.

---

## 15. Accessibility and child-friendly interaction

**Exists today and stays:** keyboard and touch controls; 56 px targets; text size (Normal, Big, Extra big); read-aloud on fact cards and quizzes; reduced motion, following the computer's setting live; word-and-mark feedback, not colour alone; focus traps and live regions; no data leaves the page; works with storage blocked.

**New in 2.0:**
- **Listen everywhere:** Orbit's words, mission lines, reward screens, Journal pages and patch conditions.
- **Controls:** mouse and touchpad steering (drag to steer, for Chromebooks), a floating touch stick that starts where the thumb lands, and gamepad support (Phase 2). Boost can be **hold** or **tap to toggle**.
- **Flight assists** setting (section 13). One-button play stays possible: pick a place on the Star Map and press Autopilot.
- **Sound** (MVP effects, Phase 2 music): separate volume for effects, music and voice. Every sound has a visual partner, so nothing needs sound to play.
- **No flashing, no camera shake,** and nothing that strobes in any mode.
- **Reading:** every new text has the same limits as today's fact cards (short sentences, checked by the data tests).
- **Child safety:** no free text anywhere (call signs come from a list), no links out of the game, no personal questions (Weigh-in uses a backpack, not the kid), nothing scary in art, sound or words.
- **Breaks:** sessions have natural endings (reward screens and chapter ends) instead of endless chains.

---

## 16. Feature priority list

Every phase is built on the foundations already in the roadmap: #26-#32 (PR #14 fixes, CI, Chromebook measurement, safe saves, quick fixes, Chromebook readiness, screen manager). Presentation work (the cinematic pass #22 and the glass UI #21) runs alongside and is designed in `VISUAL_DESIGN.md`, not here.

### MVP: essential (a complete 2.0 loop)
| # | Feature | Sections | Roadmap / issue |
| --- | --- | --- | --- |
| 1 | Title screen, First flight, Star Map, Mission Control (Missions, Hangar, Journal, Patches, Settings) | 1, 2 | #32 then #18 |
| 2 | Fly-by views with 3 dots, a "find 3" mission and a postcard question for the 7 other worlds and the Moon | 6, 8 | Step 8, #19 |
| 3 | Question pools, shuffled answers, question levels | 8, 13 | Step 10, #19 |
| 4 | Capsules on flights, and the honest speed lesson | 6.3 | Steps 5, 12; #30, #19 |
| 5 | Asteroid Belt Run with 3 courses, stopwatch, bounce | 7 | Steps 11, 13; #19 |
| 6 | XP, 8 ranks, stars on the Star Map, the reward screen | 3, 10 | Step 9, #20 |
| 7 | Grand Tour chapters 1-4 | 9 | #19, #20 |
| 8 | Rocket customization: paint, decals, exhaust | 4 | Step 14, #20 |
| 9 | Journal (fact pages and capsule facts, found dots remembered) and 12 patches | 11, 12 | Step 19 (moved earlier), #20 |
| 10 | Sound effects with their own volume, Listen everywhere | 15 | Step 15 (effects only, moved earlier) |

### Phase 2: important
| # | Feature | Sections |
| --- | --- | --- |
| 1 | Astronaut model and customization; patches on the suit | 5 |
| 2 | Photo Detective, Planet Lineup, Weigh-in, Light-Speed Messenger | 8 |
| 3 | Ring Gate Runs (one route per chapter) | 7 |
| 4 | Rescue missions and Orbit's requests | 7, 9 |
| 5 | Moon landing in an Apollo panorama | 6 |
| 6 | Gear: Telescope (hidden dots) and Radio dish | 4 |
| 7 | Spacecraft cards and postcards; 12 more patches | 11, 12 |
| 8 | Music; gamepad; floating stick; mouse steering if not done in MVP | 15 |

### Phase 3: advanced
| # | Feature | Sections |
| --- | --- | --- |
| 1 | Two advanced challenges, chosen after playtests (Ring Slalom, Comet Chase, Gravity Slingshot) | 7 |
| 2 | Rocket parts (nose and fin shapes) and paint patterns | 4 |
| 3 | Spectrometer and Magnetometer gear | 4 |
| 4 | Orbit in 3D | |
| 5 | Up to three pilots on one computer, and "start over" (deletes data: the product owner decides) | |

---

## 17. What we are not building

To keep the scope realistic, these are out of 2.0:
- Multiplayer, online features, accounts, chat, leaderboards, sharing.
- Coins, shops, spending, random rewards, daily rewards, streaks, energy or lives.
- Combat, weapons, enemies, damage or health bars.
- Walking around on planet surfaces as a 3D character, or procedurally generated planets.
- Voice input, the camera, free-text input.
- More than one new challenge in MVP, or more than two in Phase 3.
- Full landings on worlds without a real NASA surface photo.

---

## 18. Save data (summary for #29 and #18)

Kept in `localStorage`, under the rules in #29: read the version and upgrade, keep unknown fields, merge by kind.

| Data | Kind | Merge rule |
| --- | --- | --- |
| Per-world flags: mission, quiz, perfect (exist today) | Flags | Either copy on wins |
| Found dots, capsule facts, journal pages | Sets | Union |
| Patches earned | Set | Union |
| XP | Number | Worked out from the sets and flags above, so it never needs merging |
| Challenge stars | Flags | Either copy on wins |
| Personal bests | Numbers | The best wins |
| Equipped rocket and astronaut items, call sign | Choices | Newest wins (timestamped) |
| Settings | Choices | As today |

Unlocks are never stored: they are worked out from ranks, stars and patches.

---

## 19. Decisions (approved 2026-11-11)

The product owner approved all eight:
1. **Three kinds of progress** (stars, XP, patches) and no coins.
2. **The Grand Tour guides but never locks** worlds.
3. **The asteroid belt is a new place** on the Star Map.
4. **Two roadmap moves:** the Journal and patches into MVP, and sound effects into MVP (music stays in Phase 2).
5. **Call signs from a list,** no free text anywhere.
6. **Gear shows more but never helps you win.**
7. **The astronaut in Phase 2,** because it needs a new Blender model.
8. **Fly-by worlds get one postcard question,** not a full 3-question quiz.
