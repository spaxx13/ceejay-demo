"""Regenerates public/ph-addresses-far.json (the "Other Provinces" home
service queue's Province -> City -> Barangay dropdown data) from the PSGC
API (https://psgc.gitlab.io/api/), which mirrors the PSA's official
Philippine Standard Geographic Code.

Unlike the "near" queue (which covers whole provinces), the "far" queue
only actually serves two independent/highly-urbanized cities — Davao City
and Zamboanga City — so each province entry here is scoped to just that
one city, not every municipality in the province. Davao City and
Zamboanga City are administratively independent of any province, but
PSGC nests their codes under Davao del Sur and Zamboanga del Sur
respectively, so that's where they're looked up from.

Usage: python3 scripts/build-ph-addresses-far.py
"""

import json
import urllib.request

API = "https://psgc.gitlab.io/api"

# province label -> the one city/HUC under it that this queue serves.
FAR_AREAS = {
    "Davao del Sur": "City of Davao",
    "Zamboanga del Sur": "City of Zamboanga",
}


def fetch(path):
    with urllib.request.urlopen(f"{API}/{path}", timeout=60) as r:
        return json.load(r)


def slugify(name: str) -> str:
    return name.lower().replace(" ", "_")


def main():
    provinces = {p["name"]: p for p in fetch("provinces.json")}
    cities_municipalities = fetch("cities-municipalities.json")
    barangays = fetch("barangays.json")

    cm_by_code = {cm["code"]: cm for cm in cities_municipalities}
    brgy_by_parent = {}
    for b in barangays:
        parent = b["cityCode"] or b["municipalityCode"]
        if parent:
            brgy_by_parent.setdefault(parent, []).append(b["name"])

    result = []
    for province_name, city_name in FAR_AREAS.items():
        # PSGC's own "Del"/"De" capitalization -> standard PH usage.
        label = province_name
        province = provinces[province_name.replace(" del ", " Del ").replace(" de ", " De ")]
        city = next(cm for cm in cities_municipalities if cm["provinceCode"] == province["code"] and cm["name"] == city_name)
        barangay_list = sorted(brgy_by_parent.get(city["code"], []))
        if not barangay_list:
            print(f"WARNING: no barangays for {label} / {city_name}")
        result.append({"key": slugify(label), "label": label, "cities": [{"name": city_name, "barangays": barangay_list}]})

    with open("public/ph-addresses-far.json", "w") as f:
        json.dump(result, f, separators=(",", ":"), ensure_ascii=False)

    total_brgy = sum(len(c["barangays"]) for p in result for c in p["cities"])
    print(f"provinces: {len(result)}, barangays: {total_brgy}")


if __name__ == "__main__":
    main()
