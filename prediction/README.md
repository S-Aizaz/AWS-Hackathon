# Prediction engine

Turns weather + terrain signals for a point and time window into a structured
prediction with the four W's: **what / where / when / why**.

This lives alongside the Earth Explorer globe app and reuses the **same two
public data sources** the app already uses (so predictions line up with what a
user sees when they click a location):

- **Weather** — Open-Meteo forecast API (rainfall, humidity, pressure, temperature)
- **Place name** — OpenStreetMap Nominatim reverse geocoding

Terrain signals (low-lying / wetness / land type) come from Clay and are not
wired yet — `fetch_clay()` is a clearly marked stub, and predictions note a
caveat when terrain data is unavailable.

## Files

| File | What it is |
| --- | --- |
| `engine.py` | Pure prediction logic. Signals in → four-W prediction out. No network. |
| `sources.py` | The only file that fetches data. Open-Meteo + Nominatim wired live; Clay stubbed. |
| `live.py` | End-to-end runner against live data. |
| `sample.py` | Offline example with hard-coded signals. |

## Run

Requires Python 3.10+ (standard library only — no dependencies).

```bash
cd prediction
python3 live.py 13.08 80.27 flood     # lat  lon  outcome
python3 sample.py                      # offline, hard-coded signals
```

Supported outcomes: `flood`, `heatwave`, `drought`.

## How a prediction is made

```
signals  ->  thresholds  ->  combining rule  ->  risk + confidence + why
```

Each outcome is one function in `engine.py` (see the `PREDICTORS` registry).
Add a new outcome by writing another function with the same shape. Thresholds
(the numbers that decide "heavy rain", "heat", etc.) live in the `Thresholds`
class at the top of `engine.py`.

## Output shape

Every prediction is a structured record:

- **what** — the checkable claim + the threshold that makes it true/false
- **where** — place name + bounding box
- **when** — issued time, valid window, and when it can be checked
- **why** — reasoning, the exact drivers, caveats, and every signal used
- **verification** — left empty, filled in later when the outcome is checked

## Attribution

- Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0)
- Place data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL)
