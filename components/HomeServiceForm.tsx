"use client";

import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { submitHomeServiceRequest, sendHomeServiceOtp, verifyHomeServiceOtp } from "@/lib/actions";
import { OTP_GATE_ENABLED } from "@/lib/config";
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

// Matches the notice shown right above this dropdown — these require
// in-branch equipment/parts we don't bring on a home visit, so they're kept
// out of the options a customer can actually pick here (they're still
// listed on the public Services page and the in-branch POS/checklist flow,
// just not bookable as a home service).
const EXCLUDED_FROM_HOME_SERVICE = new Set(["Camera", "Backhousing(Whole shell including backglass)", "Logic board problem"]);

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
  const [brandId, setBrandId] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [barangay, setBarangay] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const [vlogConsent, setVlogConsent] = useState(false);

  // Province -> City -> Barangay cascading data for the "near" queue only —
  // fetched on demand from a static asset (curated/filtered PSGC data for
  // just these 8 areas) rather than bundled into the JS, since "far"
  // customers never need it.
  const [phData, setPhData] = useState<PhProvince[] | null>(null);
  useEffect(() => {
    if (area !== "near") return;
    fetch("/ph-addresses-near.json")
      .then((r) => r.json())
      .then(setPhData)
      .catch(() => setPhData([]));
  }, [area]);
  const selectedPhProvince = phData?.find((p) => p.label === province) ?? null;
  const selectedPhCity = selectedPhProvince?.cities.find((c) => c.name === city) ?? null;

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

  const modelsForBrand = useMemo(() => models.filter((m) => m.brandId === brandId), [models, brandId]);
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
        // On the "near" queue, City/Province are driven by the cascading
        // dropdown (which also captures Barangay) — autofilling them here
        // from Google's own text would just as often mismatch that curated
        // list's exact option strings and silently reset the selects.
        if (area !== "near") {
          const comp = (type: string) => place.address_components?.find((c) => c.types.includes(type))?.long_name ?? "";
          setCity(comp("locality") || comp("administrative_area_level_2"));
          setProvince(comp("administrative_area_level_1"));
        }
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
          Your reference number is
          <br />
          <span className="font-mono text-base font-semibold text-blue-300">{state.reference}</span>
        </p>
        <p className="text-sm text-slate-400">{content.successBody}</p>
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
      case "issue":
        return renderGenericField(field, "issueDescription");
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
      case "province":
        // The "near" queue always gets the cascading Province -> City ->
        // Barangay picker (overriding whatever type the admin configured for
        // Province/City) since it's the whole point of splitting this queue
        // out by area — the City field (below) renders nothing here, its
        // spot in the field order is absorbed into this group.
        if (area === "near") {
          const provinces = phData ?? [];
          return (
            <div key={field.id} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">
                  Province {asterisk}
                </label>
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
                <label className="text-xs font-medium text-slate-500">
                  City / Municipality {asterisk}
                </label>
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
        // Controlled + synced from the street autocomplete only while this
        // field is at its natural text type; any other type is a plain,
        // uncontrolled field (autocomplete has nothing to sync into).
        if (field.type !== "text") return renderGenericField(field, "province");
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            <input
              name="province"
              required={req}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="input"
              placeholder={field.placeholder}
            />
          </div>
        );
      case "datetime":
        return renderGenericField(field, "preferredDatetime");
      case "photo":
        // A photo can't become text/select/checkbox without losing the
        // actual image, so this one ignores `type` and always renders the
        // upload widget.
        return (
          <div key={field.id} className="space-y-2">
            <PhotoUpload label={field.label} required={req} />
            <FormNotice icon="📷">
              Please upload a photo of the device information (e.g. Settings &gt; About screen, or the back of the unit showing the model)
              and, if applicable, a photo of the device&apos;s physical condition.
            </FormNotice>
          </div>
        );
      case "device_brand":
        if (field.type !== "select") return renderGenericField(field, "deviceBrandId");
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            <select
              name="deviceBrandId"
              required={req}
              className="input"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setShowOther(e.target.value === "other");
              }}
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
        // Off its native "select" type, this still lands in `deviceOther`
        // (the free-text fallback the rest of the app already understands)
        // rather than a dead field.
        if (field.type !== "select") return renderGenericField(field, "deviceOther");
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            {showOther || modelsForBrand.length === 0 ? (
              <input name="deviceOther" required={req} className="input" placeholder={field.placeholder} />
            ) : (
              <select name="deviceModelId" required={req} className="input">
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
        if (field.type !== "select") return renderGenericField(field, "serviceTypeId");
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            <FormNotice>
              We do not offer backglass replacement, camera repair, and board/power related issues on home service. You may contact our
              branches for any concerns that is not listed on the dropdown list below.
            </FormNotice>
            <select name="serviceTypeId" required={req} className="input">
              <option value="">Select service type...</option>
              {serviceTypes
                .filter((s) => !EXCLUDED_FROM_HOME_SERVICE.has(s.label))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>
          </div>
        );
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
                Please enter your City, Province, and Landmark manually below — this helps our technician find you accurately.
              </FormNotice>
            )}
            <input type="hidden" name="lat" value={lat ?? ""} />
            <input type="hidden" name="lng" value={lng ?? ""} />
          </div>
        );
      case "city":
        // Absorbed into the cascading group rendered by "province" above.
        if (area === "near") return null;
        if (field.type !== "text") return renderGenericField(field, "city");
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              {field.label} {asterisk}
            </label>
            <input name="city" required={req} value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder={field.placeholder} />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <form ref={formRef} action={formAction} className="card space-y-5">
      <input type="hidden" name="serviceArea" value={area} />
      {fields.map((f) => (f.systemKey ? renderSystemField(f) : <DynamicFormField key={f.id} field={f} />))}

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}

      <FormNotice icon="🚚">
        <p>
          Before submitting, please ensure that all details are correct and accurate to avoid delays. If we need further verification
          please expect a call from us.
        </p>
        <p className="mt-2 font-semibold">A flat rate service fee of ₱500.00 is applicable within Metro Manila area.</p>
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
