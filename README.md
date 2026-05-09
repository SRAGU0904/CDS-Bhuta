# CDS Bhuta Sculpture Prototype

An interactive web prototype for displaying and painting Bhuta deity sculptures in 3D. Users can rotate statues using a phone gyroscope (via Zig Sim) or mouse drag, watch faded/recolored transitions, and apply custom paint colours to individual surface regions.

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| 3D rendering | Three.js · React Three Fiber · Drei |
| Styling | Tailwind CSS |

---

## Project Structure

```
CDS-Bhuta/
├── app/                          # Next.js App Router pages & API routes
│   ├── layout.tsx                # Root HTML shell
│   ├── page.tsx                  # Main entry — renders <Scene />
│   ├── screen/page.tsx           # Alternate full-screen view
│   ├── data/page.tsx             # Raw Zig Sim data inspector
│   └── api/
│       ├── zigsim/route.ts       # GET: latest sensor packets
│       └── [...slug]/route.ts    # POST: receives Zig Sim HTTP packets
│
├── components/
│   ├── Scene.tsx                 # Root React component: state, Canvas, overlays
│   └── scene/                   # Scene sub-modules
│       ├── types.ts              # Shared TypeScript types & constants
│       ├── config.ts             # Statue configs (STATUE_CONFIGS, DEITY_REGIONS)
│       ├── useZigSimYaw.ts       # Hook: polls /api/zigsim, smooths yaw signal
│       ├── modelPair.ts          # 3D utilities: ModelPair, opacity, metrics
│       ├── coloringMaterial.ts   # PBR shader for per-region paint overlay
│       ├── DualSculpture.tsx     # Main 3D component: rotation, animation, pairs
│       ├── ColoringPanel.tsx     # Paint UI: region list + colour picker
│       └── UI.tsx                # MusicControl · ControlModeToggle · ViewFrames
│
├── server/
│   ├── zigsim.ts                 # In-memory packet store (latest sensor data)
│   └── websocket.ts              # (Reserved) WebSocket server stub
│
└── public/
    ├── models/                   # GLB models + partID texture
    │   ├── Panjurli_faded.glb
    │   ├── Panjurli_recolored.glb
    │   ├── Deity_faded.glb
    │   ├── Deity_recolored.glb
    │   └── deity_original_Material.003_BaseColor.png   # Greyscale partID map
    └── audio/
        └── bg-2.mp3
```

---

## Architecture Overview

### Rendering pipeline

```
Scene.tsx  (state: yaw, controlMode, statueIndex, coloringMode, confirmedSelections)
  └─ <Canvas orthographic>
       └─ DualSculpture
            ├─ front statue group  (x = -1.5)
            │    ├─ Pedestal
            │    └─ ModelView  ── fadedScene / recoloredScene / coloringScene
            └─ back statue group   (x = +1.5)
                 ├─ Pedestal
                 └─ ModelView  ── same three layers, rotated 180°
```

Each statue is rendered as **three overlapping scene layers** whose opacity is driven every frame:

| Mode | fadedScene | recoloredScene | coloringScene |
|---|---|---|---|
| Default | `1 − progress` | `progress` | `0` |
| Coloring mode (locked) | `0` | `0` | `1` |
| Confirmed custom paint | `1 − progress` | `0` | `progress` |

`progress` (`colorProgressRef`) accumulates as the user rotates and lerps back to its idle target (0 for default, 1 for confirmed paint) on inactivity.

### Rotation & statue switching

`useZigSimYaw` polls `/api/zigsim` at 100 ms, accumulates delta yaw from the phone quaternion, and feeds a smoothed value to `DualSculpture`. Mouse drag is supported as a fallback.

Inside `useFrame`, rotation in one direction accumulates `totalRotationRef`. After **3 full turns** in the same direction the statue switches to the next one (`SWITCH_THRESHOLD_RAD = 6π`). Reversing reduces the total instead of resetting it, making the threshold robust to sensor noise.

### Custom paint system

The paint system works in two layers:

**PartID map** (`deity_original_Material.003_BaseColor.png`) — a greyscale texture exported from Substance Painter. Each grey value identifies a surface region:

| Region | Grey value (0 – 1) |
|---|---|
| Necklace | 0.000 |
| Body | 0.125 |
| Eyeliner & Pupils | 0.250 |
| Eye Whites & Teeth | 0.375 |
| Lower Garment | 0.500 |
| Waist Ornament | 0.625 |
| Waist Details | 0.750 |
| Chest Sash | 0.875 |
| Anklets | 1.000 |

**`coloringMaterial.ts`** clones the source `MeshStandardMaterial` from the recolored GLB and uses `onBeforeCompile` to inject a GLSL snippet after the `map_fragment` stage. The snippet reads the partID texture and, when a region has a chosen colour (`col0`–`col8` uniforms), overrides `diffuseColor.rgb`. All PBR lighting (normal maps, roughness, metalness) is preserved.

Uniforms are updated imperatively via `applySelectionsToMaterial` whenever the user picks a colour in `ColoringPanel`, so no material recompile is needed.

---

## Getting Started

### 1. Install Node.js

```bash
node -v
npm -v
```

Both commands should return version numbers.

### 2. Clone and install

```bash
git clone <repository-url>
cd CDS-Bhuta
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Stop the server

Press `Ctrl + C` in the terminal.

---

## Zig Sim Setup (phone gyroscope control)

The app receives phone sensor data from [Zig Sim Pro](https://zig-project.com/) via HTTP POST and rotates the sculpture in real time.

### Step 1 — find your PC's IP address

**Windows (PowerShell):**
```powershell
ipconfig
```
Look for **IPv4 Address** (e.g. `192.168.x.x` or `10.x.x.x`).

### Step 2 — configure Zig Sim

| Setting | Value |
|---|---|
| Output format | HTTP POST |
| Target URL | `http://<your-ip>:3000` |
| Sensors | Attitude (gyroscope) |

The app extracts yaw from the quaternion automatically. Both the PC and phone must be on the same network.

### Debugging

| What | How |
|---|---|
| Inspect incoming packets | `GET http://localhost:3000/api/zigsim` |
| Server logs | Terminal running `npm run dev` |
| Connection issues | Confirm same Wi-Fi, check firewall allows port 3000 |

---

## Adding a New Statue

1. Export from Substance Painter: `<Name>_faded.glb`, `<Name>_recolored.glb`, and optionally a greyscale partID PNG.
2. Place all files under `public/models/`.
3. Add an entry to `STATUE_CONFIGS` in `components/scene/config.ts`. Include `partIDTexturePath` and `regions` if the statue supports painting.
4. Add `useGLTF.preload(...)` calls at the bottom of `components/Scene.tsx`.
5. Handle the new `config.id` in the `useMemo` inside `DualSculpture.tsx`.

---

## Notes

- Browsers block autoplay audio. Click the 🔇 button once to start background music.
- The coloring feature is currently only available for the **Deity** statue; Panjurli support requires a partID texture export from Substance.
