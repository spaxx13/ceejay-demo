"""Builds public/ph-addresses-all.json — every province, city/municipality and
barangay in the Philippines, in the same shape as ph-addresses-near.json
({key, label, cities: [{name, barangays}]}) — for the Courier Service form's
Province -> City -> Barangay dropdowns.

Source: the `@ianlabicani/geoph-lite` npm package (MIT), which ships the
PSA's Philippine Standard Geographic Code (PSGC) as of 30 June 2026. The PSGC
data is CC BY 4.0, Philippine Statistics Authority:
https://psa.gov.ph/classification/psgc/index

Install the package somewhere outside the repo, then point this script at its
regions folder:

    npm i @ianlabicani/geoph-lite --prefix /tmp/psgc
    python3 scripts/build-ph-addresses-all.py /tmp/psgc/node_modules/@ianlabicani/geoph-lite/regions

The PSGC lists independent / highly urbanized cities (Cebu City, Davao City,
...) directly under their region, not under a province. Customers write their
address under the province they're customarily in, so each one is placed in
INDEPENDENT_CITY_PROVINCE below. NCR is one "Metro Manila" entry, and the
BARMM Special Geographic Area municipalities, which belong to no province,
get their own entry.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# PSGC locality name -> the province it is customarily written under.
INDEPENDENT_CITY_PROVINCE = {
    "City of Angeles": "Pampanga",
    "City of Olongapo": "Zambales",
    "City of Lucena": "Quezon",
    "City of Iloilo": "Iloilo",
    "City of Cebu": "Cebu",
    "City of Lapu-Lapu": "Cebu",
    "City of Mandaue": "Cebu",
    "City of Tacloban": "Leyte",
    "City of Isabela": "Basilan",
    "City of Zamboanga": "Zamboanga del Sur",
    "City of Cagayan De Oro": "Misamis Oriental",
    "City of Iligan": "Lanao del Norte",
    "City of Davao": "Davao del Sur",
    "City of General Santos": "South Cotabato",
    "City of Baguio": "Benguet",
    "City of Butuan": "Agusan del Norte",
    "City of Puerto Princesa": "Palawan",
    "City of Bacolod": "Negros Occidental",
}
SGA_LABEL = "Special Geographic Area (BARMM)"


def slugify(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


def locality(loc):
    return {"name": loc["name"], "barangays": sorted({b["name"].strip() for b in loc["barangays"]})}


def main():
    src = Path(sys.argv[1])
    provinces = {}  # label -> list of localities

    def add(label, loc):
        provinces.setdefault(label, []).append(locality(loc))

    regions = [json.load(open(f, encoding="utf-8")) for f in sorted(src.glob("*.json"))]
    # Provinces first, so region-level cities can be filed under them.
    for region in regions:
        for prov in region["provinces"]:
            provinces.setdefault(prov["name"], [])
            for loc in prov["localities"]:
                add(prov["name"], loc)
    for region in regions:
        for loc in region["localities"]:
            if region["name"].startswith("National Capital Region"):
                add("Metro Manila", loc)
            elif loc["name"] in INDEPENDENT_CITY_PROVINCE:
                target = INDEPENDENT_CITY_PROVINCE[loc["name"]]
                if target not in provinces:
                    sys.exit(f"{loc['name']}: province {target!r} not found")
                add(target, loc)
            elif loc["type"] == "municipality":
                add(SGA_LABEL, loc)
            else:
                sys.exit(f"Unplaced region-level locality: {loc['name']} ({region['name']})")

    out = []
    for label in sorted(provinces, key=str.lower):
        cities = sorted(provinces[label], key=lambda c: c["name"])
        if cities:
            out.append({"key": slugify(label), "label": label, "cities": cities})

    path = ROOT / "public" / "ph-addresses-all.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_city = sum(len(p["cities"]) for p in out)
    n_brgy = sum(len(c["barangays"]) for p in out for c in p["cities"])
    print(f"{len(out)} provinces, {n_city} cities/municipalities, {n_brgy} barangays -> {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
