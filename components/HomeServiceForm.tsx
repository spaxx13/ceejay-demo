"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { submitHomeServiceRequest, sendHomeServiceOtp, verifyHomeServiceOtp } from "@/lib/actions";
import { OTP_GATE_ENABLED, BOOKING_CONFIRMATION_WINDOW_HOURS } from "@/lib/config";
import { PROVINCE_FEES, SUNDAY_ONLY_PROVINCES, nextSunday } from "@/lib/homeServiceFees";
import PhotoUpload from "./PhotoUpload";
import DynamicFormField from "./DynamicFormField";
import type { RequestFormContent, CustomFormField, HomeServiceQueue } from "@/lib/types";

// Shared styling for every customer-facing note/reminder on this form —
// bolder border, background, and text than a plain hint so it actually
// gets noticed instead of blending into the surrounding whitespace.
function FormNotice({ children, tone = "amber", icon = "⚠️" }: { children: React.ReactNode; tone?: "amber" | "blue"; icon?: string }) {
  const toneClasses = tone === "blue" ? "border-blue-300 bg-blue-50 text-blue-900" : "border-amber-300 bg-amber-50 text-amber-900";
  return (
    <div className={`flex items-start gap-2 rounded-lg border-2 p-3 text-sm font-medium leading-snug ${toneClasses}`}>
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>
          ) => {
            addListener: (event: string, cb: () => void) => void;
            getPlace: () => {
              address_components?: { long_name: string; types: string[] }[];
              geometry?: { location: { lat: () => number; lng: () => number } };
            };
          };
        };
      };
    };
  }
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };
type PhCity = { name: string; barangays: string[] };
type PhProvince = { key: string; label: string; cities: PhCity[] };

// One "+ Add Another Device" block's local UI state — everything else about
// a device (issue description, photo, screen quality, etc.) lives directly
// in the DOM as an indexed, uncontrolled field (deviceBrandId_0, _1, ...)
// and is read from FormData on submit; only the bits that drive conditional
// rendering need to be tracked here. `key` is a stable id for React and for
// removal — not the same as the device's index, which shifts as blocks are
// added/removed.
type DeviceState = { key: number; brandId: string; showOther: boolean; serviceTypeId: string; agreedToServiceNotice: boolean };
const DEVICE_FIELD_KEYS = new Set(["device_brand", "device_model", "service_type", "issue", "photo"]);

// Matches the notice shown right above this dropdown — these require
// in-branch equipment/parts we don't bring on a home visit, so they're kept
// out of the options a customer can actually pick here (they're still
// listed on the public Services page and the in-branch POS/checklist flow,
// just not bookable as a home service).
const EXCLUDED_FROM_HOME_SERVICE = new Set(["Camera", "Backhousing(Whole shell including backglass)", "Logic board problem", "Charging Port"]);

// A customer must tick "I Agree" after reading this before they can submit —
// set-expectation notices for parts Apple serializes/verifies, so a
// "Unverified"/"Important Message" prompt on the customer's device later
// isn't mistaken for something the technician did wrong.
const SERVICE_TYPE_AGREEMENT_NOTICES: Record<string, string> = {
  "Battery Replacement":
    'For series 12 and above we use batteries that can be verified. The "unverified" message can be fixed after the replacement. The technician will provide instructions on how to do the fix. Please click "Agree" if you wish to proceed',
  "Screen Repair":
    'Since Apple serialized some parts like LCD and camera, please expect that a message that says "Important Message" message will show up within settings. This is normal for both OLED and original replacement since the part serial number is attached on the original one. This is normal and this will not affect the performance of the device',
};

export default function HomeServiceForm({
  brands,
  models,
  serviceTypes,
  content,
  fields,
  area,
}: {
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  content: RequestFormContent;
  fields: CustomFormField[];
  area: HomeServiceQueue;
}) {
  const [state, formAction, pending] = useActionState(submitHomeServiceRequest, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [barangay, setBarangay] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const [vlogConsent, setVlogConsent] = useState(false);

  // One or more devices per booking — starts with a single blank block;
  // "+ Add Another Device" appends another, sharing the contact/address
  // fields above and below instead of asking the customer to fill the
  // whole form out again per device.
  const nextDeviceKeyRef = useRef(1);
  const [devices, setDevices] = useState<DeviceState[]>([{ key: 0, brandId: "", showOther: false, serviceTypeId: "", agreedToServiceNotice: false }]);
  function addDevice() {
    setDevices((d) => [...d, { key: nextDeviceKeyRef.current++, brandId: "", showOther: false, serviceTypeId: "", agreedToServiceNotice: false }]);
  }
  function removeDevice(key: number) {
    setDevices((d) => (d.length > 1 ? d.filter((x) => x.key !== key) : d));
  }
  function updateDevice(key: number, patch: Partial<DeviceState>) {
    setDevices((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  // Province -> City -> Barangay cascading data, fetched on demand from a
  // static PSGC-derived asset rather than bundled into the JS — the "near"
  // queue's 8 areas (~100KB) and the "far" queue's other 74 provinces
  // nationwide (~470KB, includes Davao City and Zamboanga City under their
  // PSGC-linked provinces) are separate files so neither customer downloads
  // data for the queue they didn't pick.
  const [phData, setPhData] = useState<PhProvince[] | null>(null);
  useEffect(() => {
    const file = area === "near" ? "/ph-addresses-near.json" : "/ph-addresses-far.json";
    fetch(file)
      .then((r) => r.json())
      .then(setPhData)
      .catch(() => setPhData([]));
  }, [area]);
  const selectedPhProvince = phData?.find((p) => p.label === province) ?? null;
  const selectedPhCity = selectedPhProvince?.cities.find((c) => c.name === city) ?? null;

  // Shown in the notice right above Submit — reflects whichever area is
  // actually selected instead of a fixed Metro Manila figure, since the
  // flat rate differs by province (and, for some provinces, by town).
  function serviceFeeNote(): string | null {
    const fee = PROVINCE_FEES[province];
    if (!fee) return null;
    const peso = (n: number) => `₱${n.toLocaleString()}.00`;
    if (fee.higherTowns && fee.higherFee) {
      if (city && fee.higherTowns.includes(city)) {
        return `A flat rate service fee of ${peso(fee.higherFee)} is applicable for ${city}, ${province}.`;
      }
      return `A flat rate service fee of ${peso(fee.base)} is applicable within ${province}, except for ${fee.higherTowns.join(
        ", "
      )}, where the service fee is ${peso(fee.higherFee)}.`;
    }
    return `A flat rate service fee of ${peso(fee.base)} is applicable within ${province} area.`;
  }

  // Email OTP verification — anti-spam gate, run at submit time: the
  // customer fills out the whole form, hits Submit, and only entering the
  // code that arrives by email actually completes the request. Nothing is
  // written to the server until the code is verified.
  const [otpStage, setOtpStage] = useState<"idle" | "sent">("idle");
  const [sentEmail, setSentEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");

  async function handleProceedToOtp() {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return; // surfaces the browser's native "please fill this in" on any missing required field
    const email = String(new FormData(form).get("email") ?? "").trim();
    setOtpError("");
    setSendingOtp(true);
    try {
      const res = await sendHomeServiceOtp(email);
      if (res.ok) {
        setSentEmail(email);
        setOtpCode("");
        setOtpStage("sent");
      } else {
        setOtpError(res.error);
      }
    } catch {
      setOtpError("Something went wrong sending the code — please try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleResendOtp() {
    setOtpError("");
    setSendingOtp(true);
    try {
      const res = await sendHomeServiceOtp(sentEmail);
      if (res.ok) {
        setOtpCode("");
      } else {
        setOtpError(res.error);
      }
    } catch {
      setOtpError("Something went wrong sending the code — please try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyAndSubmit() {
    setOtpError("");
    setVerifyingOtp(true);
    try {
      const res = await verifyHomeServiceOtp(sentEmail, otpCode);
      if (!res.ok) {
        setOtpError(res.error);
        return;
      }
      const form = formRef.current;
      if (!form) return;
      // requestSubmit() re-runs native HTML5 validation on the whole form —
      // if anything above (e.g. the photo upload) is missing or invalid,
      // the browser silently blocks the submit with no visible feedback
      // here, which looked like "nothing happens" after entering the code.
      // Surface that explicitly instead of failing silently.
      if (!form.reportValidity()) {
        setOtpError("Some details above are missing or invalid — please scroll up, fix the highlighted field, and try again.");
        return;
      }
      form.requestSubmit();
    } catch {
      setOtpError("Something went wrong submitting your request — please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  const streetActive = fields.some((f) => f.systemKey === "street");
  const emailField = fields.find((f) => f.systemKey === "email");
  const emailGateActive = OTP_GATE_ENABLED && (emailField?.active ?? false);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !streetActive) return;

    function initAutocomplete() {
      if (!window.google || !streetRef.current) return;
      const autocomplete = new window.google.maps.places.Autocomplete(streetRef.current, {
        componentRestrictions: { country: "ph" },
        fields: ["address_components", "geometry"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        // City/Province/Barangay are always driven by the cascading dropdown
        // below (both queues) — autofilling them here from Google's own text
        // would just as often mismatch that curated list's exact option
        // strings and silently reset the selects. Only the geocoded
        // coordinates are useful from this autocomplete now.
        if (place.geometry?.location) {
          setLat(place.geometry.location.lat());
          setLng(place.geometry.location.lng());
        }
      });
    }

    if (window.google) {
      initAutocomplete();
      return;
    }
    const existing = document.getElementById("google-maps-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", initAutocomplete);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = initAutocomplete;
    document.head.appendChild(script);
  }, [streetActive, area]);

  if (state?.ok) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-lg font-semibold text-slate-800">{content.successTitle}</h2>
        <p className="text-sm text-slate-400">
          Your reference number{state.references.length > 1 ? "s are" : " is"}
          <br />
          <span className="font-mono text-base font-semibold text-blue-300">{state.references.join(", ")}</span>
        </p>
        <p className="text-sm text-slate-400">{content.successBody}</p>
        {sentEmail && (
          <FormNotice tone="blue" icon="📧">
            <p className="font-semibold">Check your email to confirm your booking</p>
            <p className="mt-1">
              We sent your repair quotation to <span className="font-semibold">{sentEmail}</span>. Please open it and click{" "}
              <span className="font-semibold">Confirm My Booking</span> within {BOOKING_CONFIRMATION_WINDOW_HOURS} hours, or your
              request will be automatically cancelled.
            </p>
          </FormNotice>
        )}
        <a href={`/request?area=${area}`} className="btn-secondary inline-block">
          Submit another request
        </a>
      </div>
    );
  }

  // Generic renderer used by every field that respects its own `type` —
  // which is every field except the catalog-backed pickers (below) when
  // they're at their natural "select" type, and Photo (always bespoke).
  function renderGenericField(field: CustomFormField, name: string, inputType: "text" | "email" = "text") {
    const req = field.required;
    const asterisk = req && <span className="text-red-600">*</span>;

    if (field.type === "checkbox") {
      return (
        <label key={field.id} className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name={name} value="on" className="h-4 w-4 rounded border-slate-300" />
          {field.label} {asterisk}
        </label>
      );
    }

    return (
      <div key={field.id} className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          {field.label} {asterisk}
        </label>
        {field.type === "select" ? (
          <select name={name} required={req} className="input">
            <option value="">Select...</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea name={name} required={req} rows={3} className="input" placeholder={field.placeholder} />
        ) : field.type === "date" ? (
          <input type="date" name={name} required={req} className="input" />
        ) : field.type === "datetime" ? (
          <input type="datetime-local" name={name} required={req} className="input" />
        ) : (
          <input type={inputType} name={name} required={req} className="input" placeholder={field.placeholder} />
        )}
      </div>
    );
  }

  function renderSystemField(field: CustomFormField) {
    const req = field.required;
    const asterisk = req && <span className="text-red-600">*</span>;

    switch (field.systemKey) {
      case "name":
        return renderGenericField(field, "name");
      case "phone":
        return renderGenericField(field, "phone");
      case "email":
        // OTP verification (when the gate is on) now happens at submit
        // time, not inline here — see the bottom of the form.
        return renderGenericField(field, "email", "email");
      // "issue" is rendered per device by renderDeviceBlockField below.
      case "landmark":
        return (
          <Fragment key={field.id}>
            {renderGenericField(field, "landmark")}
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="vlogConsent"
                  value="on"
                  checked={vlogConsent}
                  onChange={(e) => setVlogConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                May we vlog (record) this service visit for our content, e.g. social media or marketing?
              </label>
              {vlogConsent && (
                <div className="space-y-1.5 pl-6">
                  <label className="text-xs font-medium text-slate-500">
                    Should your face be blurred in the footage? <span className="text-red-600">*</span>
                  </label>
                  <select name="vlogBlurPreference" required className="input">
                    <option value="">Select preference...</option>
                    <option value="blurred">Blurred</option>
                    <option value="not_blurred">Not Blurred</option>
                  </select>
                </div>
              )}
            </div>
          </Fragment>
        );
      case "province": {
        // Both queues get the cascading Province -> City -> Barangay picker
        // (overriding whatever type the admin configured for Province/City),
        // each backed by its own curated PSGC dataset — the City field
        // (below) renders nothing here, its spot in the field order is
        // absorbed into this group.
        const provinces = phData ?? [];
        return (
          <div key={field.id} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Province {asterisk}</label>
              <select
                name="province"
                required={req}
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setCity("");
                  setBarangay("");
                }}
                className="input"
                disabled={!phData}
              >
                <option value="">{phData ? "Select province..." : "Loading..."}</option>
                {provinces.map((p) => (
                  <option key={p.key} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">City / Municipality {asterisk}</label>
              <select
                name="city"
                required={req}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setBarangay("");
                }}
                className="input"
                disabled={!selectedPhProvince}
              >
                <option value="">Select city/municipality...</option>
                {(selectedPhProvince?.cities ?? []).map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">
                Barangay <span className="text-red-600">*</span>
              </label>
              <select
                name="barangay"
                required
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="input"
                disabled={!selectedPhCity}
              >
                <option value="">Select barangay...</option>
                {(selectedPhCity?.barangays ?? []).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      }
      case "datetime":
        if (area === "near" && SUNDAY_ONLY_PROVINCES.has(province)) {
          return (
            <div key={field.id} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">
                {field.label} {asterisk}
              </label>
              <input type="date" name="preferredDatetime" required={req} min={nextSunday()} step={7} className="input" />
              <FormNotice tone="blue" icon="📅">
                Home service for {province} is available every Sunday only — please pick a Sunday date.
              </FormNotice>
            </div>
          );
        }
        return renderGenericField(field, "preferredDatetime");
      // device_brand, device_model, service_type, issue, and photo are
      // rendered per device by renderDeviceBlockField below instead of
      // here — see the "+ Add Another Device" repeater.
      case "street":
        // Places autocomplete only attaches while this field is at its
        // natural text type — otherwise there's no single text input to
        // anchor it to.
        if (field.type !== "text") return renderGenericField(field, "street");
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            <input ref={streetRef} name="street" required={req} className="input" placeholder={field.placeholder} />
            {!GOOGLE_MAPS_KEY && (
              <FormNotice tone="blue" icon="📍">
                Please also fill in your Landmark below — this helps our technician find you accurately.
              </FormNotice>
            )}
            <input type="hidden" name="lat" value={lat ?? ""} />
            <input type="hidden" name="lng" value={lng ?? ""} />
          </div>
        );
      case "city":
        // Absorbed into the cascading group rendered by "province" above,
        // for both queues.
        return null;
      default:
        return null;
    }
  }

  // The device-specific portion of the form (brand, model, service type +
  // its conditional follow-ups, issue, photo) — rendered once per entry in
  // `devices` instead of once for the whole form, each with its own
  // indexed field names (e.g. deviceBrandId_0, deviceBrandId_1, ...) so
  // lib/actions.ts can read `deviceCount` devices back out of one FormData.
  function renderDeviceBlockField(field: CustomFormField, device: DeviceState, index: number, update: (patch: Partial<DeviceState>) => void) {
    const req = field.required;
    const asterisk = req && <span className="text-red-600">*</span>;
    const modelsForBrand = models.filter((m) => m.brandId === device.brandId);
    const selectedServiceType = serviceTypes.find((s) => s.id === device.serviceTypeId);
    const agreementNotice = selectedServiceType ? SERVICE_TYPE_AGREEMENT_NOTICES[selectedServiceType.label] : undefined;

    switch (field.systemKey) {
      case "device_brand":
        if (field.type !== "select") return renderGenericField(field, `deviceBrandId_${index}`);
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            <select
              name={`deviceBrandId_${index}`}
              required={req}
              className="input"
              value={device.brandId}
              onChange={(e) => update({ brandId: e.target.value, showOther: e.target.value === "other" })}
            >
              <option value="">Select brand...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
              <option value="other">Other — please specify</option>
            </select>
          </div>
        );
      case "device_model":
        if (field.type !== "select") return renderGenericField(field, `deviceOther_${index}`);
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            {device.showOther || modelsForBrand.length === 0 ? (
              <input name={`deviceOther_${index}`} required={req} className="input" placeholder={field.placeholder} />
            ) : (
              <select name={`deviceModelId_${index}`} required={req} className="input">
                <option value="">Select model...</option>
                {modelsForBrand.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="">Other — specify below</option>
              </select>
            )}
          </div>
        );
      case "service_type":
        if (field.type !== "select") return renderGenericField(field, `serviceTypeId_${index}`);
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            <FormNotice>
              We do not offer backglass replacement, camera repair, and board/power related issues on home service. You may contact our
              branches for any concerns that is not listed on the dropdown list below.
            </FormNotice>
            <select
              name={`serviceTypeId_${index}`}
              required={req}
              value={device.serviceTypeId}
              onChange={(e) => update({ serviceTypeId: e.target.value, agreedToServiceNotice: false })}
              className="input"
            >
              <option value="">Select service type...</option>
              {serviceTypes
                .filter((s) => !EXCLUDED_FROM_HOME_SERVICE.has(s.label))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>
            {selectedServiceType?.label === "Screen Repair" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">
                  Screen Quality <span className="text-red-600">*</span>
                </label>
                <select name={`screenQuality_${index}`} required className="input">
                  <option value="">Select quality...</option>
                  <option value="original">Original</option>
                  <option value="high_quality">High Quality (compatible)</option>
                </select>
              </div>
            )}
            {selectedServiceType?.label === "Back Housing (whole shell)" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">
                  Back Housing Color <span className="text-red-600">*</span>
                </label>
                <input name={`backHousingColor_${index}`} required className="input" placeholder="e.g. Space Gray, Midnight Green" />
              </div>
            )}
            {agreementNotice && (
              <div className="space-y-2">
                <FormNotice tone="blue">{agreementNotice}</FormNotice>
                <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    required
                    checked={device.agreedToServiceNotice}
                    onChange={(e) => update({ agreedToServiceNotice: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  I Agree <span className="text-red-600">*</span>
                </label>
              </div>
            )}
          </div>
        );
      case "issue":
        return renderGenericField(field, `issueDescription_${index}`);
      case "photo":
        // A photo can't become text/select/checkbox without losing the
        // actual image, so this one ignores `type` and always renders the
        // upload widget.
        return (
          <div key={field.id} className="space-y-2">
            <PhotoUpload name={`photoDataUrl_${index}`} label={field.label} required={req} />
            <FormNotice icon="📷">
              Please upload a photo of the device information (e.g. Settings &gt; About screen, or the back of the unit showing the model)
              and, if applicable, a photo of the device&apos;s physical condition.
            </FormNotice>
          </div>
        );
      default:
        return null;
    }
  }

  // Fields are already sorted by the admin's configured order (see
  // app/(site)/request/page.tsx). The device-scoped fields (brand, model,
  // service type, issue, photo) are pulled out as one contiguous block —
  // wherever they fall in that order — and rendered once per device
  // instead of once for the whole form; everything before/after them stays
  // shared across the whole booking, same as before this repeater existed.
  const deviceKeyIndexes = fields.map((f, i) => (f.systemKey && DEVICE_FIELD_KEYS.has(f.systemKey) ? i : -1)).filter((i) => i >= 0);
  const firstDeviceIdx = deviceKeyIndexes[0] ?? -1;
  const lastDeviceIdx = deviceKeyIndexes[deviceKeyIndexes.length - 1] ?? -1;
  const fieldsBeforeDevices = firstDeviceIdx >= 0 ? fields.slice(0, firstDeviceIdx) : fields;
  const deviceFields = firstDeviceIdx >= 0 ? fields.slice(firstDeviceIdx, lastDeviceIdx + 1) : [];
  const fieldsAfterDevices = firstDeviceIdx >= 0 ? fields.slice(lastDeviceIdx + 1) : [];

  return (
    <form ref={formRef} action={formAction} className="card space-y-5">
      <input type="hidden" name="serviceArea" value={area} />
      <input type="hidden" name="deviceCount" value={devices.length} />
      {fieldsBeforeDevices.map((f) => (f.systemKey ? renderSystemField(f) : <DynamicFormField key={f.id} field={f} />))}

      {devices.map((device, index) => (
        <div key={device.key} className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Device {index + 1}</h3>
            {devices.length > 1 && (
              <button type="button" onClick={() => removeDevice(device.key)} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            )}
          </div>
          {deviceFields.map((f) => (f.systemKey ? renderDeviceBlockField(f, device, index, (patch) => updateDevice(device.key, patch)) : null))}
        </div>
      ))}
      <button type="button" onClick={addDevice} className="btn-secondary w-full text-sm">
        + Add Another Device
      </button>

      {fieldsAfterDevices.map((f) => (f.systemKey ? renderSystemField(f) : <DynamicFormField key={f.id} field={f} />))}

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}

      <FormNotice icon="🚚">
        <p>
          Before submitting, please ensure that all details are correct and accurate to avoid delays. If we need further verification
          please expect a call from us.
        </p>
        {serviceFeeNote() && <p className="mt-2 font-semibold">{serviceFeeNote()}</p>}
      </FormNotice>

      {!emailGateActive && (
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Submitting..." : content.submitButtonLabel}
        </button>
      )}

      {emailGateActive && otpStage === "idle" && (
        <>
          <button type="button" onClick={handleProceedToOtp} disabled={sendingOtp} className="btn-primary w-full">
            {sendingOtp ? "Sending verification code..." : content.submitButtonLabel}
          </button>
          {otpError && <p className="text-center text-sm text-red-600">{otpError}</p>}
        </>
      )}

      {emailGateActive && otpStage === "sent" && (
        <div className="space-y-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">🔒 Verify your email to complete this request</p>
          <p className="text-sm font-medium text-blue-900">
            Please enter the OTP that we sent to your email address ({sentEmail}). This will help us ensure that the service booking is
            legitimate and requested by a real human. Please check your inbox or Spam/Junk folder.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={handleVerifyAndSubmit}
              disabled={verifyingOtp || pending || otpCode.length !== 6}
              className="btn-primary shrink-0 !px-4"
            >
              {verifyingOtp ? "Verifying..." : pending ? "Submitting..." : "Verify & Submit"}
            </button>
          </div>
          {otpError && <p className="text-sm text-red-600">{otpError}</p>}
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={handleResendOtp} disabled={sendingOtp} className="font-medium text-blue-700 hover:underline">
              {sendingOtp ? "Resending..." : "Resend code"}
            </button>
            <button type="button" onClick={() => setOtpStage("idle")} className="text-slate-500 hover:underline">
              ← Edit request details
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
