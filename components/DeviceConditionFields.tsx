"use client";

import PhotoUpload from "./PhotoUpload";
import { DEVICE_CONDITION_ITEMS, type DeviceConditionItem } from "@/lib/types";

const ITEM_LABELS: Record<DeviceConditionItem, string> = {
  front: "Front",
  back: "Back",
  leftSide: "Left Side",
  rightSide: "Right Side",
  top: "Top",
  bottom: "Bottom",
  lcd: "LCD",
  touch: "Touch",
  camera: "Camera",
  housing: "Housing",
  buttons: "Buttons",
  chargingPort: "Charging Port",
};

// Rendered inside RiderStatusUpdateForm when the rider picks "Picked Up" —
// the device-condition checklist and the labeled proof-of-pickup photos the
// FINAL FLOW spec requires before a unit can be taken from the customer.
// Field names (condition_<item>, photo_<slot>) match what
// riderUpdatePickupStatus's "picked_up" case reads back out of the FormData.
export default function DeviceConditionFields() {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-700">Device Condition Checklist</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {DEVICE_CONDITION_ITEMS.map((item) => (
          <div key={item} className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">{ITEM_LABELS[item]}</label>
            <select name={`condition_${item}`} required defaultValue="" className="input !py-1 text-xs">
              <option value="" disabled>
                Check...
              </option>
              <option value="ok">OK</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Existing Damage Notes (if any)</label>
        <textarea name="existingDamageNotes" rows={2} className="input" placeholder="Describe any pre-existing damage..." />
      </div>
      <p className="pt-1 text-xs font-semibold text-slate-700">Required Photos</p>
      <PhotoUpload name="photo_front" label="Front" required />
      <PhotoUpload name="photo_back" label="Back" required />
      <PhotoUpload name="photo_left" label="Left Side" required />
      <PhotoUpload name="photo_right" label="Right Side" required />
      <PhotoUpload name="photo_topBottom" label="Top / Bottom" required />
      <PhotoUpload name="photo_damage" label="Damaged Area(s) (if any)" />
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-medium text-slate-500">Security Seal # (optional)</label>
        <input name="securitySeal" className="input" placeholder="e.g. Seal #004829" />
        <p className="text-[11px] text-slate-400">If you sealed the package, write the seal number here so the shop can verify it on arrival.</p>
      </div>
    </div>
  );
}
