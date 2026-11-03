"""
End-to-end: fetch live data from Open-Meteo + Nominatim (+ Clay stub),
then make a prediction with the four W's.

Run:  python live.py [lat] [lon] [outcome]
Example:  python live.py 13.08 80.27 flood
"""

import json
import sys

from engine import Window, now_utc, predict
from sources import gather


def main() -> None:
    lat = float(sys.argv[1]) if len(sys.argv) > 1 else 13.08
    lon = float(sys.argv[2]) if len(sys.argv) > 2 else 80.27
    outcome = sys.argv[3] if len(sys.argv) > 3 else "flood"
    hours = 24

    print(f"Fetching live signals for ({lat}, {lon}) ...")
    signals, place, raw = gather(lat, lon, hours=hours)

    print(f"  place    : {place.name}")
    print(f"  rainfall : {signals.rainfall_mm_24h} mm / {hours}h")
    print(f"  humidity : {signals.humidity_pct} %")
    print(f"  pressure : {signals.pressure_trend}")
    print(f"  temp     : {signals.temperature_c} C")
    print(f"  clay     : low_lying={signals.terrain_low_lying} "
          f"wet={signals.already_wet} land={signals.land_type}")
    print()

    prediction = predict(
        outcome=outcome,
        signals=signals,
        place=place,
        window=Window(issued_at=now_utc(), hours=hours),
    )

    print(json.dumps(prediction.as_dict(), indent=2))


if __name__ == "__main__":
    main()
