"""
Connectors: turn live data sources into the engine's `Signals` object.

Sources:
  - Weather   -> Open-Meteo forecast API   (current + 5-day, no key, CC BY 4.0)
  - Place name-> OpenStreetMap Nominatim    (reverse geocoding, no key, ODbL)
  - Clay      -> terrain / satellite signals (teammate fills in; see note below)

The engine (engine.py) stays pure. This file is the ONLY place that talks to
the outside world, so it is the one thing that depends on the servers being up.

Attribution (must be shown in any UI panel):
  Weather data by Open-Meteo.com (CC BY 4.0)
  Place data (c) OpenStreetMap contributors (ODbL)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import urllib.parse
import urllib.request
import json

from engine import Signals, Place

# polite, identifiable user agent (Nominatim requires one)
_USER_AGENT = "clay-earth-foundry-prediction/1.0"
_TIMEOUT = 20


def _get_json(url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


# --------------------------------------------------------------------------
# 1. Weather  ->  Open-Meteo
# --------------------------------------------------------------------------

@dataclass
class WeatherReading:
    """Weather signals aggregated over the forecast window."""
    rainfall_mm_window: float      # total precipitation over the window
    humidity_pct: float            # avg relative humidity over the window
    pressure_trend: str            # "falling" | "steady" | "rising"
    temperature_c: float           # peak temperature over the window
    raw: dict[str, Any]            # full response, kept for the trace


def fetch_weather(lat: float, lon: float, hours: int = 24) -> WeatherReading:
    """Pull forecast weather for a point and summarize it over `hours`."""
    params = urllib.parse.urlencode({
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,relative_humidity_2m,surface_pressure,temperature_2m",
        "forecast_days": 5,
        "timezone": "UTC",
    })
    url = f"https://api.open-meteo.com/v1/forecast?{params}"
    data = _get_json(url)

    hourly = data.get("hourly", {})
    precip = hourly.get("precipitation", []) or []
    humidity = hourly.get("relative_humidity_2m", []) or []
    pressure = hourly.get("surface_pressure", []) or []
    temp = hourly.get("temperature_2m", []) or []

    # take the first `hours` entries as the prediction window
    n = min(hours, len(precip), len(humidity), len(pressure), len(temp))
    if n == 0:
        raise RuntimeError("Open-Meteo returned no hourly data")

    rainfall_total = round(sum(precip[:n]), 1)
    humidity_avg = round(sum(humidity[:n]) / n, 1)
    temp_peak = round(max(temp[:n]), 1)

    # pressure trend: compare start vs end of the window
    delta = pressure[n - 1] - pressure[0]
    if delta <= -2:
        trend = "falling"
    elif delta >= 2:
        trend = "rising"
    else:
        trend = "steady"

    return WeatherReading(
        rainfall_mm_window=rainfall_total,
        humidity_pct=humidity_avg,
        pressure_trend=trend,
        temperature_c=temp_peak,
        raw=data,
    )


# --------------------------------------------------------------------------
# 2. Place name  ->  Nominatim reverse geocoding
# --------------------------------------------------------------------------

def fetch_place_name(lat: float, lon: float) -> str:
    """Reverse-geocode a point to a human-readable place name."""
    params = urllib.parse.urlencode({"lat": lat, "lon": lon, "format": "json"})
    url = f"https://nominatim.openstreetmap.org/reverse?{params}"
    try:
        data = _get_json(url)
    except Exception:
        return f"{lat:.4f}, {lon:.4f}"
    addr = data.get("address", {})
    # prefer city/town/village, fall back to the full display name
    for key in ("city", "town", "village", "county", "state"):
        if addr.get(key):
            parts = [addr[key]]
            if addr.get("state") and addr["state"] != addr[key]:
                parts.append(addr["state"])
            if addr.get("country"):
                parts.append(addr["country"])
            return ", ".join(parts)
    return data.get("display_name", f"{lat:.4f}, {lon:.4f}")


# --------------------------------------------------------------------------
# 3. Clay  ->  terrain / satellite signals
#
# Open-Meteo + Nominatim do NOT provide terrain. These three signals come from
# Clay (embeddings / terrain classification). This is the one source not wired
# here. Replace the body below with the real Clay call when it's available.
# Until then it returns conservative defaults so the pipeline runs end to end.
# --------------------------------------------------------------------------

@dataclass
class ClayReading:
    terrain_low_lying: bool
    already_wet: bool
    land_type: str                 # "urban" | "farmland" | "forest" | ...
    raw: dict[str, Any]


def fetch_clay(lat: float, lon: float) -> ClayReading:
    """
    TEAMMATE: replace this stub with the real Clay call.

    Expected to return: is the terrain low-lying/flood-prone, is the ground
    already wet (standing water / saturation), and the land type. These drive
    the flood/drought rules in engine.py.
    """
    # --- stub defaults (safe, neutral) ---------------------------------
    return ClayReading(
        terrain_low_lying=False,
        already_wet=False,
        land_type="unknown",
        raw={"note": "clay stub - not yet wired"},
    )


# --------------------------------------------------------------------------
# Assemble everything into the engine's Signals + Place.
# --------------------------------------------------------------------------

def gather(lat: float, lon: float, hours: int = 24,
           area_km2: float = 100.0) -> tuple[Signals, Place, dict[str, Any]]:
    """
    Call all sources for a point and build the engine inputs.

    Returns (signals, place, raw) where `raw` holds each source's raw payload
    so it can be handed to whoever records the trace.
    """
    weather = fetch_weather(lat, lon, hours)
    place_name = fetch_place_name(lat, lon)
    clay = fetch_clay(lat, lon)

    signals = Signals(
        rainfall_mm_24h=weather.rainfall_mm_window,
        humidity_pct=weather.humidity_pct,
        pressure_trend=weather.pressure_trend,
        temperature_c=weather.temperature_c,
        terrain_low_lying=clay.terrain_low_lying,
        already_wet=clay.already_wet,
        land_type=clay.land_type,
    )

    # a small bbox around the point (~0.05 deg each side)
    d = 0.05
    place = Place(
        name=place_name,
        bbox=[round(lon - d, 4), round(lat - d, 4), round(lon + d, 4), round(lat + d, 4)],
        area_km2=area_km2,
    )

    raw = {
        "weather": weather.raw,
        "place": place_name,
        "clay": clay.raw,
    }
    return signals, place, raw
