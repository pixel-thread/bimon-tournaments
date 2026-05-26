---
description: BGMI Stream OCR Desktop App — Context & Build Instructions
---

# BGMI Stream OCR Desktop App

## What This Is

We're building a **local web-based desktop app** for auto-detecting which player is being spectated in BGMI (Battlegrounds Mobile India) during tournament streams. It reads the player name from the screen using OCR and sends it to a stream overlay.

## The System (Already Deployed)

- **Web app**: Next.js deployed at `https://bgmi.pixel-thread.in`
- **Stream overlay page**: `https://bgmi.pixel-thread.in/stream/overlay?token=TOKEN` — shows player stats when spectating
- **Stream control page**: `https://bgmi.pixel-thread.in/stream/control` — manual player selection UI
- **WebSocket relay**: `scripts/stream-relay.mjs` — local relay at `ws://localhost:9876` for instant communication between OCR script, overlay, and control panel
- **API endpoints** (token-protected):
  - `GET /api/stream/tournaments?token=xxx` — list tournaments
  - `GET /api/stream/players?token=xxx&tournamentId=xxx` — list players with stats
  - `POST /api/stream/state?token=xxx` — update selected player `{ selectedPlayerId, isVisible }`
  - `GET /api/stream/state?token=xxx` — get current state

## What We're Building (NEW)

A local app at `scripts/ocr-app/` that replaces the old template-matching approach (`scripts/stream-ocr.mjs`) with **real OCR**.

### Why Replace Template Matching?

The old approach required manually capturing a reference image for every player (60+ players) by pausing a YouTube VOD on each one. Too slow and breaks if resolution changes.

### New App Architecture

```
scripts/ocr-app/
├── server.mjs          # Express server + OCR engine + WebSocket client
├── start.bat           # One-click Windows launcher
└── public/
    ├── index.html      # Dashboard UI
    ├── style.css       # Dark gaming theme
    └── app.js          # Client-side logic
```

**Single Node.js process** that:
1. Serves a web dashboard at `http://localhost:4000`
2. Captures screen region using `screenshot-desktop` + `sharp`
3. Preprocesses image (grayscale → invert → threshold → scale up) for white-on-dark gaming text
4. Runs OCR via `Tesseract.js` (worker initialized once, reused)
5. Fuzzy-matches OCR text against tournament player names using `fastest-levenshtein`
6. Sends matched player to relay via WebSocket (`ws://localhost:9876`)
7. Also sends to API as backup (`POST /api/stream/state`)
8. Streams live updates to dashboard via Server-Sent Events (SSE)

### Tech Stack & Dependencies

Already installed: `sharp`, `screenshot-desktop`, `ws`
Need to install: `tesseract.js`, `fastest-levenshtein`, `express`

```bash
npm install tesseract.js fastest-levenshtein express
```

### Key Technical Details (From Research)

**Tesseract.js OCR:**
- Create worker ONCE at startup, reuse for all frames
- Use fast language data: `langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast'`
- PSM mode 7 = single text line (player name)
- Character whitelist: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-.|`
- **CRITICAL**: White text on dark background MUST be inverted before OCR

**Image Preprocessing Pipeline (sharp):**
```javascript
sharp(imageBuffer)
  .grayscale()
  .negate()           // Invert: white text → black text on white bg
  .threshold(128)     // Binary threshold
  .resize({ width: 800, fit: 'inside' })  // Scale up for accuracy
  .png()
  .toBuffer()
```

**Fuzzy Matching:**
```javascript
const { closest, distance } = require('fastest-levenshtein');
const bestMatch = closest(ocrText, playerNames);
const dist = distance(ocrText, bestMatch);
// Reject if distance > 40% of name length
```

### Dashboard Features

1. **Setup Panel**: Take screenshot → drag-to-select capture region → save config
2. **Live Monitor**: Real-time feed showing captured image → preprocessed → OCR text → matched player
3. **Player List**: All tournament players, highlights current match
4. **Controls**: Start/Stop toggle, interval slider, confidence threshold
5. **Status Bar**: Relay connection, API connection, detection speed

### Screen Capture Region

- User's screen is **1920×1080**
- BGMI runs via **Scrcpy** (phone mirrored to PC)
- Player name appears at bottom-center of spectator view
- Previously calibrated region: `x=690, y=730, w=220, h=25` (when Scrcpy is fullscreen)
- Region is configurable via the dashboard's drag-to-select tool

### Config Storage

Config saved to `scripts/ocr-app/.ocr-config.json`:
```json
{
  "region": { "x": 690, "y": 730, "width": 220, "height": 25 },
  "apiUrl": "https://bgmi.pixel-thread.in",
  "token": "",
  "intervalMs": 200,
  "confidenceThreshold": 0.4,
  "debounceCount": 3
}
```

### How the Relay Works

The relay (`scripts/stream-relay.mjs`) runs on `ws://localhost:9876`. All clients connect to it:
- **OCR app** sends `{ type: "select", playerId: "xxx" }` when it detects a player
- **Overlay** (OBS browser source) receives the selection and shows player stats
- **Control panel** can also send selections manually
- Messages are broadcast to ALL connected clients

### Windows Environment Notes

- Node.js v24.16.0, npm 11.13.0, Git 2.54.0
- PowerShell execution policy set to `RemoteSigned`
- PATH requires refresh after install: `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`
- Repo cloned to: `C:\Users\123bi\bimon-tournaments`
