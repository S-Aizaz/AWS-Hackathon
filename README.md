# AWS-Hackathon: Earth Explorer

An interactive 3D Earth built with React, TypeScript, Vite, three.js, `@react-three/fiber` and `@react-three/drei`.

**Phase 1 (current):** realistic globe (4K day map, terrain relief, sun glint on the oceans, city lights on the night side, clouds, atmosphere, stars), auto-rotation that pauses while you interact, click-to-select with lat/lng, adjustable lighting, and a risk-zone overlay showing sample data.
**Later phases:** weather for the selected point and live safe/critical zones. The extension points are already in place (see [Extending](#extending)).

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the lat/lng math
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

Controls: **drag** to rotate, **scroll/pinch** to zoom, **click/tap** to select a location. Auto-rotation pauses while you interact and eases back in 3 s after you stop.

Top-right buttons:

- **Spin:** stop or start the Earth's rotation.
- **Clouds:** show or hide the cloud layer.
- **Display:** opens the lighting and quality panel:
  - **Presets:** *Realistic* (fixed sun, dark night side with city lights), *Bright* (the sun sits behind you, so whatever you look at is in daylight) and *Even* (soft light everywhere, best for reading the risk overlays).
  - **Brightness** (exposure), **Sunlight**, **Night-side fill**, **Sun direction**, **Light where I'm looking**.
  - **City lights at night** on/off, **Texture quality** 2K/4K.

Settings are remembered in the browser (localStorage).

## Textures

The textures are already in the repo, in two sizes:

```
public/textures/4k/   ≈2.2 MB, used by default on desktop
public/textures/2k/   ≈0.9 MB, used by default on phones (switchable in Display → Texture quality)
  earth_day.jpg                     day colour map (Blue Marble)
  earth_night.jpg                   city lights, shown only on the night side
  earth_bump_roughness_clouds.jpg   three greyscale maps packed into one image:
                                      R = elevation (bump), G = land mask (oceans shiny), B = clouds
```

They're three.js's example copies of NASA's public-domain Blue Marble / Black Marble imagery
(`https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets`). The 2K files are downscales of the 4K ones. To fetch them again:

```bash
base=https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets
mkdir -p public/textures/4k
for n in day night bump_roughness_clouds; do
  curl -fL -o public/textures/4k/earth_$n.jpg "$base/earth_${n}_4096.jpg"
done
# 2K: resize each to 2048×1024 with any image tool, into public/textures/2k/ with the same names
```

**Even higher resolution (optional):** NASA Visible Earth (<https://visibleearth.nasa.gov/collection/1484/blue-marble>) has the original imagery at up to 21600×10800. 8K (8192×4096) is the practical ceiling: it's sharp when fully zoomed in, but phones may run out of GPU memory. Keep the same three file layouts (pack elevation, land mask and clouds into R/G/B), then add a new entry to `TEXTURE_SETS` in [src/config.ts](src/config.ts).

If a texture is missing, the app shows an error screen pointing back here instead of rendering a blank canvas.

## Project structure

```
src/
  App.tsx                     Page layout, selection state, calls the location service
  config.ts                   Tunables: radius, tilt, speeds, camera limits, texture sets, risk colours
  settings.ts                 Display settings: defaults, lighting presets, slider ranges, validation
  types/index.ts              LatLng, RiskLevel, LocationInfo, RiskZone
  components/
    Scene.tsx                 Lights + sun position, exposure, stars, OrbitControls, composes Globe + overlays
    Globe.tsx                 Earth mesh + material (bump, ocean glint, night lights), tilt/spin, click → lat/lng
    Clouds.tsx                Cloud shell, drifts faster than the ground
    Atmosphere.tsx            Fresnel halo + rim shaders (follow the sun)
    SettingsPanel.tsx         Spin / Clouds buttons and the Display panel
    LocationMarker.tsx        Pulsing marker at a lat/lng
    RiskOverlay.tsx           Coloured geodesic circles for RiskZone[]
    InfoPanel.tsx             Side panel (Coordinates / Weather / Risk status)
    RiskLegend.tsx            Colour legend
    CanvasErrorBoundary.tsx   Friendly error if WebGL or textures fail
  hooks/useIdleAutoRotate.ts  Spin on/off, pause-on-interaction / resume-after-3 s logic
  hooks/useGlobeSettings.ts   Settings state, persisted to localStorage
  services/locationService.ts getLocationInfo(lat, lng) stub (plug the weather API in here)
  data/sampleZones.ts         Hard-coded demo RiskZone[]
  utils/geo.ts                latLngToVector3, vector3ToLatLng, worldPointToLatLng, distance helpers
  utils/geo.test.ts           Vitest unit tests (+ settings.test.ts)
```

Rendering, interaction, overlays and data are separate: `Globe` knows nothing about risk or weather, and the overlays know nothing about where their data comes from.

## How the lat/lng math works

**Convention** (in the Earth mesh's local frame, matching three.js `SphereGeometry` UVs so the texture lines up):

```
x =  r·cos(lat)·cos(lng)      +X → (0°, 0°)
y =  r·sin(lat)               +Y → North Pole
z = -r·cos(lat)·sin(lng)      -Z → (0°, 90°E)

lat = asin(y / |p|)
lng = atan2(-z, x)
```

A unit test samples `SphereGeometry` vertices and checks that their UVs agree with these formulas, which proves the texture and the math line up.

**Rotation compensation.** The scene graph is `tilt group (23.4° about Z) → spin group (rotation.y grows every frame) → Earth mesh`. A raycast hit (`event.point`) is in **world** space, so the same screen pixel lands on a different place on Earth as it turns. `worldPointToLatLng` calls `earthMesh.worldToLocal(point)`, which applies the inverse of the mesh's full world matrix. That undoes the tilt and the current spin angle (and any scale or offset) in one step, before converting to lat/lng.

The reverse direction needs no compensation: markers and overlays are rendered *inside* the spin group at `latLngToVector3(lat, lng)`, so they turn with the planet automatically.

**Click vs drag.** R3F reports `event.delta`, the pixels moved between pointer-down and pointer-up. Clicks with `delta > 5` (`DRAG_THRESHOLD_PX`) are treated as drags and ignored.

## Extending

- **Weather:** implement the fetch in `getLocationInfo` in [src/services/locationService.ts](src/services/locationService.ts) and fill in `name`, `weather` and `risk`. The `AbortSignal` is already wired, so a new click cancels a stale request. `InfoPanel` renders whatever comes back.
- **Live risk zones:** replace `SAMPLE_RISK_ZONES` in [src/App.tsx](src/App.tsx) with fetched `RiskZone[]`. `<RiskOverlay zones={...} />` needs no changes. Colours come from `RISK_COLORS` in `config.ts`.
- **"Is this point in a zone?":** `greatCircleDistanceKm(point, zone) <= zone.radiusKm` (in `utils/geo.ts`).

## Performance notes

- Pixel ratio is capped at 2 (`dpr={[1, 2]}`).
- 4K textures on desktop, 2K on phones/touch devices (user can switch). Anisotropic filtering up to 16×. Textures are uploaded to the GPU right after loading so the first frame doesn't stall, and switching quality keeps showing the old globe until the new textures are ready.
- One packed texture serves bump, ocean roughness and clouds, which saves two texture downloads and two GPU uploads.
- **R3F gotcha:** R3F copies a `<shaderMaterial uniforms={...}>` object into the material's own uniforms, so later changes must go through a ref to `material.uniforms` (see `RiskOverlay.tsx` and `Atmosphere.tsx`).
- Clouds, overlays and markers don't write depth and use explicit `renderOrder`, so there's no transparency sorting flicker.
