"""
Runnable example of the prediction engine.

The `signals` here stand in for what you'd get back from the two weather MCPs
and Clay. When the real data is wired up, build a `Signals` object from it and
pass it to `predict()` the same way.

Run:  python sample.py
"""

import json

from engine import Place, Signals, Thresholds, Window, now_utc, predict


# --- 1. Signals for one place/time (fake values; swap in real MCP/Clay data) ---
signals = Signals(
    rainfall_mm_24h=68.0,       # weather MCP A: forecast rain
    humidity_pct=94.0,          # weather MCP B
    pressure_trend="falling",   # weather MCP B
    temperature_c=29.0,         # weather MCP
    terrain_low_lying=True,     # Clay: flood-prone terrain
    already_wet=True,           # Clay: standing water present
    land_type="urban",          # Clay
)

place = Place(
    name="Chennai metro, Tamil Nadu, India",
    bbox=[80.20, 12.95, 80.30, 13.10],
    area_km2=120.0,
)

window = Window(issued_at=now_utc(), hours=24)


# --- 2. Make the prediction ---
prediction = predict(
    outcome="flood",
    signals=signals,
    place=place,
    window=window,
    thresholds=Thresholds(),    # use defaults, or tune the knobs here
)


# --- 3. Show it ---
print(json.dumps(prediction.as_dict(), indent=2))

print("\n--- human-readable ---")
p = prediction
print(f"WHAT : {p.what['claim']} (confidence {p.confidence:.2f})")
print(f"WHERE: {p.where['location_name']}")
print(f"WHEN : {p.when['valid_from']} -> {p.when['valid_to']}")
print(f"WHY  : {p.why['reasoning']}")
