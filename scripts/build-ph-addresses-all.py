"""Builds public/ph-addresses-all.json — every province, city/municipality and
barangay in the Philippines, in the same shape as ph-addresses-near.json
({key, label, cities: [{name, barangays}]}) — for the Courier Service form's
Province -> City -> Barangay dropdowns.

Source: the open-source `phil-reg-prov-mun-brgy` npm package (PSGC data, ISC
license), which ships regions/provinces/city-mun/barangays JSON. Install it
somewhere outside the repo, then point this script at its src/json folder:

    npm i phil-reg-prov-mun-brgy --prefix /tmp/psgc
    python3 scripts/build-ph-addresses-all.py /tmp/psgc/node_modules/phil-reg-prov-mun-brgy/src/json

That package's data is older than the PSGC the near-area file was built from,
so the seven provinces already in public/ph-addresses-near.json (Metro Manila
and its neighbours) are taken from that file instead. Metro Manila is also
one entry there, where this package splits NCR into four "districts".
"""

import json
import re
import sys
from pathlib import Path

LOWER = {"of", "de", "del", "ng", "sa", "y", "the"}
ROOT = Path(__file__).resolve().parent.parent


def title(name: str) -> str:
    words = re.split(r"(\s+|-|\()", name.strip().lower())
    out = []
    first = True
    for w in words:
        if not w or w.isspace() or w in ("-", "("):
            out.append(w)
            continue
        if w in LOWER and not first:
            out.append(w)
        elif re.fullmatch(r"(i{1,3}|iv|v|vi{0,3}|ix|x)\)?", w):
            out.append(w.upper())
        else:
            out.append(w[:1].upper() + w[1:])
        first = False
    return "".join(out)


def slugify(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


def main():
    src = Path(sys.argv[1])
    provinces = json.load(open(src / "provinces.json"))
    cities = json.load(open(src / "city-mun.json"))
    barangays = json.load(open(src / "barangays.json"))
    near = json.load(open(ROOT / "public" / "ph-addresses-near.json"))
    near_keys = {p["key"] for p in near}

    brgy_by_mun = {}
    for b in barangays:
        brgy_by_mun.setdefault(b["mun_code"], []).append(b["name"].strip())

    result = {p["key"]: p for p in near}
    for prov in provinces:
        if prov["reg_code"] == "13":  # NCR districts -> Metro Manila, from the near file
            continue
        label = title(prov["name"])
        key = slugify(label)
        if key in near_keys:
            continue
        entry = result.setdefault(key, {"key": key, "label": label, "cities": []})
        for c in cities:
            if c["prov_code"] != prov["prov_code"]:
                continue
            entry["cities"].append({"name": title(c["name"]), "barangays": sorted(set(brgy_by_mun.get(c["mun_code"], [])))})
        entry["cities"].sort(key=lambda c: c["name"])

    out = sorted((p for p in result.values() if p["cities"]), key=lambda p: p["label"])
    path = ROOT / "public" / "ph-addresses-all.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_city = sum(len(p["cities"]) for p in out)
    n_brgy = sum(len(c["barangays"]) for p in out for c in p["cities"])
    print(f"{len(out)} provinces, {n_city} cities/municipalities, {n_brgy} barangays -> {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
