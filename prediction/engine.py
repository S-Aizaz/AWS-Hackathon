"""
Prediction engine.

Takes weather + Clay signals for one place and time window, and produces a
prediction with the four W's (what / where / when / why).

This module is ONLY the prediction part. It does not fetch data, call MCP
servers, trace, or score. It takes signals in, gives a structured prediction
out. Feed it real data from the weather MCPs + Clay, or the sample data in
sample.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any


# --------------------------------------------------------------------------
# Inputs: the signals that come from the two weather MCPs + Clay.
# --------------------------------------------------------------------------

@dataclass
class Signals:
    """Everything we know about one place/time, gathered from the sources."""
    # from weather sources
    rainfall_mm_24h: float          # forecast rainfall over the window
    humidity_pct: float
    pressure_trend: str             # "falling" | "steady" | "rising"
    temperature_c: float
    # from Clay (satellite / terrain)
    terrain_low_lying: bool         # flood-prone terrain?
    already_wet: bool               # standing water / saturated ground?
    land_type: str                  # e.g. "urban", "farmland", "forest"


@dataclass
class Place:
    name: str
    bbox: list[float]               # [min_lon, min_lat, max_lon, max_lat]
    area_km2: float


@dataclass
class Window:
    issued_at: datetime
    hours: int                      # how far ahead the prediction looks


# --------------------------------------------------------------------------
# Thresholds: the knobs that turn raw numbers into yes/no signals.
# Keep them explicit and in one place so they are easy to see and tune.
# --------------------------------------------------------------------------

@dataclass
class Thresholds:
    heavy_rain_mm: float = 50.0     # rainfall above this = heavy
    high_humidity_pct: float = 85.0
    heat_c: float = 40.0
    drought_rain_mm: float = 2.0    # rainfall below this = very dry


# --------------------------------------------------------------------------
# Output: the prediction, carrying the four W's and a verification stub.
# --------------------------------------------------------------------------

@dataclass
class Prediction:
    prediction_id: str
    outcome: str                    # e.g. "flood"
    risk: str                       # HIGH | MEDIUM | LOW | NONE
    confidence: float               # 0.0 - 1.0
    what: dict[str, Any]
    where: dict[str, Any]
    when: dict[str, Any]
    why: dict[str, Any]
    verification: dict[str, Any] = field(default_factory=lambda: {
        "ground_truth": None,
        "outcome": None,            # correct | partial | incorrect
        "scored_at": None,
    })

    def as_dict(self) -> dict[str, Any]:
        return {
            "prediction_id": self.prediction_id,
            "outcome": self.outcome,
            "risk": self.risk,
            "confidence": round(self.confidence, 2),
            "what": self.what,
            "where": self.where,
            "when": self.when,
            "why": self.why,
            "verification": self.verification,
        }


# --------------------------------------------------------------------------
# The rules. Each predictor takes signals + thresholds and returns:
#   (risk level, confidence, checkable claim, reasoning, list-of-drivers)
# Add a new outcome by writing a new function with the same shape.
# --------------------------------------------------------------------------

def _predict_flood(s: Signals, t: Thresholds) -> dict[str, Any]:
    heavy_rain = s.rainfall_mm_24h > t.heavy_rain_mm
    flood_prone = s.terrain_low_lying
    wet = s.already_wet

    drivers = []
    if heavy_rain:
        drivers.append(f"heavy rain forecast ({s.rainfall_mm_24h:.0f}mm > {t.heavy_rain_mm:.0f}mm)")
    if flood_prone:
        drivers.append("low-lying / flood-prone terrain")
    if wet:
        drivers.append("ground already saturated")

    if heavy_rain and flood_prone and wet:
        risk, conf = "HIGH", 0.8
    elif heavy_rain and flood_prone:
        risk, conf = "MEDIUM", 0.6
    elif heavy_rain:
        risk, conf = "LOW", 0.4
    else:
        risk, conf = "NONE", 0.3

    # supporting signals nudge confidence up
    if risk != "NONE":
        if s.humidity_pct > t.high_humidity_pct:
            conf += 0.05
        if s.pressure_trend == "falling":
            conf += 0.05
    conf = min(conf, 0.95)

    claim = (
        f"Flood risk is {risk} over the next window; "
        f"checkable proxy: rainfall > {t.heavy_rain_mm:.0f}mm."
    )
    reasoning = (
        "No significant flood drivers present." if not drivers
        else "Flood risk driven by: " + "; ".join(drivers) + "."
    )

    # be honest when terrain signals (from Clay) are not available
    caveats = []
    if s.land_type == "unknown":
        caveats.append(
            "Terrain signals (low-lying / wetness) unavailable; risk is based on "
            "weather only and may be understated. HIGH/MEDIUM require terrain data."
        )

    return {
        "risk": risk,
        "confidence": conf,
        "claim": claim,
        "variable": "rainfall_mm",
        "threshold": {"operator": ">", "value": t.heavy_rain_mm, "unit": "mm"},
        "reasoning": reasoning,
        "drivers": drivers,
        "caveats": caveats,
    }


def _predict_heatwave(s: Signals, t: Thresholds) -> dict[str, Any]:
    hot = s.temperature_c >= t.heat_c
    drivers = [f"temperature {s.temperature_c:.0f}°C ≥ {t.heat_c:.0f}°C"] if hot else []
    risk, conf = ("HIGH", 0.7) if hot else ("NONE", 0.3)
    return {
        "risk": risk,
        "confidence": conf,
        "claim": f"Heatwave risk is {risk}; checkable proxy: temperature ≥ {t.heat_c:.0f}°C.",
        "variable": "temperature_c",
        "threshold": {"operator": ">=", "value": t.heat_c, "unit": "C"},
        "reasoning": ("High temperature exceeds the heat threshold." if hot
                      else "Temperature below the heat threshold."),
        "drivers": drivers,
        "caveats": [],
    }


def _predict_drought_stress(s: Signals, t: Thresholds) -> dict[str, Any]:
    dry = s.rainfall_mm_24h < t.drought_rain_mm
    hot = s.temperature_c >= t.heat_c
    farmland = s.land_type == "farmland"
    drivers = []
    if dry:
        drivers.append(f"very low rainfall ({s.rainfall_mm_24h:.1f}mm < {t.drought_rain_mm:.0f}mm)")
    if hot:
        drivers.append(f"high temperature ({s.temperature_c:.0f}°C)")
    if farmland:
        drivers.append("land type is farmland")

    if dry and hot and farmland:
        risk, conf = "HIGH", 0.75
    elif dry and hot:
        risk, conf = "MEDIUM", 0.55
    elif dry:
        risk, conf = "LOW", 0.4
    else:
        risk, conf = "NONE", 0.3

    return {
        "risk": risk,
        "confidence": conf,
        "claim": f"Drought/crop-stress risk is {risk}; checkable proxy: rainfall < {t.drought_rain_mm:.0f}mm.",
        "variable": "rainfall_mm",
        "threshold": {"operator": "<", "value": t.drought_rain_mm, "unit": "mm"},
        "reasoning": ("Stress driven by: " + "; ".join(drivers) + "." if drivers
                      else "No drought stress indicators present."),
        "drivers": drivers,
        "caveats": (["Land type unavailable (Clay); farmland factor not applied."]
                    if s.land_type == "unknown" else []),
    }


# registry: outcome name -> predictor function
PREDICTORS = {
    "flood": _predict_flood,
    "heatwave": _predict_heatwave,
    "drought": _predict_drought_stress,
}


# --------------------------------------------------------------------------
# The public entry point.
# --------------------------------------------------------------------------

def predict(
    outcome: str,
    signals: Signals,
    place: Place,
    window: Window,
    thresholds: Thresholds | None = None,
) -> Prediction:
    """Make one prediction for the given outcome, place, and time window."""
    if outcome not in PREDICTORS:
        raise ValueError(f"Unknown outcome '{outcome}'. Choices: {list(PREDICTORS)}")

    t = thresholds or Thresholds()
    result = PREDICTORS[outcome](signals, t)

    issued = window.issued_at
    valid_to = issued + timedelta(hours=window.hours)
    pred_id = f"pred-{issued.strftime('%Y%m%d-%H%M')}-{outcome}"

    return Prediction(
        prediction_id=pred_id,
        outcome=outcome,
        risk=result["risk"],
        confidence=result["confidence"],
        what={
            "claim": result["claim"],
            "variable": result["variable"],
            "threshold": result["threshold"],
            "risk_level": result["risk"],
        },
        where={
            "location_name": place.name,
            "geometry": {"type": "bbox", "coords": place.bbox},
            "area_km2": place.area_km2,
        },
        when={
            "issued_at": issued.isoformat(),
            "valid_from": issued.isoformat(),
            "valid_to": valid_to.isoformat(),
            "check_after": valid_to.isoformat(),
        },
        why={
            "reasoning": result["reasoning"],
            "drivers": result["drivers"],
            "caveats": result.get("caveats", []),
            "signals_used": {
                "rainfall_mm_24h": signals.rainfall_mm_24h,
                "humidity_pct": signals.humidity_pct,
                "pressure_trend": signals.pressure_trend,
                "temperature_c": signals.temperature_c,
                "terrain_low_lying": signals.terrain_low_lying,
                "already_wet": signals.already_wet,
                "land_type": signals.land_type,
            },
        },
    )


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)
