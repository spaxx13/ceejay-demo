"""Regenerates public/ph-addresses-far.json (the "Other Provinces" home
service queue's Province -> City/Municipality -> Barangay dropdown data)
from the PSGC API (https://psgc.gitlab.io/api/), which mirrors the PSA's
official Philippine Standard Geographic Code. Excludes the 7 provinces
already covered by the "near" queue (public/ph-addresses-near.json).
Highly urbanized/independent cities (e.g. Davao City, Zamboanga City) are
listed under the province PSGC nests their code under, same as any other
city — matching how the near dataset already handles Metro Manila.

Usage: python3 scripts/build-ph-addresses-far.py
"""

import json
import re
import urllib.request

API = "https://psgc.gitlab.io/api"
NEAR_PROVINCE_NAMES = {"Bulacan", "Pampanga", "Batangas", "Cavite", "Laguna", "Quezon", "Rizal"}

# A handful of PSGC source entries have broken mid-name capitalization
# (e.g. "Pres. Manuel a. Roxas" instead of "... A. Roxas") — corrected here
# rather than upstream since these are the only ones found on inspection.
NAME_FIXES = {
    "Gen. s.k. Pendatun": "Gen. S.K. Pendatun",
    "Pio v. Corpuz": "Pio V. Corpuz",
    "Pres. Manuel a. Roxas": "Pres. Manuel A. Roxas",
    "Sergio osmeña Sr.": "Sergio Osmeña Sr.",
    "Vincenzo a. Sagun": "Vincenzo A. Sagun",
}


def fetch(path):
    with urllib.request.urlopen(f"{API}/{path}", timeout=60) as r:
        return json.load(r)


def normalize_province_label(name: str) -> str:
    # PSGC titlecases connector words ("Del", "De") inside province names —
    # standard PH usage lowercases them, e.g. "Zamboanga Del Sur" -> "Zamboanga del Sur".
    return re.sub(r"\b(Del|De)\b", lambda m: m.group(1).lower(), name)


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def main():
    provinces = fetch("provinces.json")
    cities_municipalities = fetch("cities-municipalities.json")
    barangays = fetch("barangays.json")

    far_provinces = [p for p in provinces if p["name"] not in NEAR_PROVINCE_NAMES]

    cm_by_province = {}
    for cm in cities_municipalities:
        cm_by_province.setdefault(cm["provinceCode"], []).append(cm)

    brgy_by_parent = {}
    for b in barangays:
        parent = b["cityCode"] or b["municipalityCode"]
        if parent:
            brgy_by_parent.setdefault(parent, []).append(b["name"])

    result = []
    for prov in far_provinces:
        label = normalize_province_label(prov["name"])
        cities = []
        for cm in cm_by_province.get(prov["code"], []):
            name = NAME_FIXES.get(cm["name"], cm["name"])
            barangay_list = sorted(brgy_by_parent.get(cm["code"], []))
            if not barangay_list:
                print(f"WARNING: no barangays for {label} / {name}")
            cities.append({"name": name, "barangays": barangay_list})
        cities.sort(key=lambda c: c["name"])
        if not cities:
            print("WARNING: no cities for province", label)
        result.append({"key": slugify(label), "label": label, "cities": cities})

    result.sort(key=lambda p: p["label"])

    with open("public/ph-addresses-far.json", "w") as f:
        json.dump(result, f, separators=(",", ":"), ensure_ascii=False)

    total_cities = sum(len(p["cities"]) for p in result)
    total_brgy = sum(len(c["barangays"]) for p in result for c in p["cities"])
    print(f"provinces: {len(result)}, cities: {total_cities}, barangays: {total_brgy}")


if __name__ == "__main__":
    main()
