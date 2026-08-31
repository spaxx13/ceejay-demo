"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { submitHomeServiceRequest } from "@/lib/actions";
import PhotoUpload from "./PhotoUpload";
import DynamicFormField from "./DynamicFormField";
import type { RequestFormContent, CustomFormField } from "@/lib/types";

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

export default function HomeServiceForm({
  brands,
  models,
  serviceTypes,
  content,
  fields,
}: {
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  content: RequestFormContent;
  fields: CustomFormField[];
}) {
  const [state, formAction, pending] = useActionState(submitHomeServiceRequest, undefined);
  const [brandId, setBrandId] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const streetRef = useRef<HTMLInputElement>(null);

  const modelsForBrand = useMemo(() => models.filter((m) => m.brandId === brandId), [models, brandId]);
  const streetActive = fields.some((f) => f.systemKey === "street");

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
        const comp = (type: string) => place.address_components?.find((c) => c.types.includes(type))?.long_name ?? "";
        setCity(comp("locality") || comp("administrative_area_level_2"));
        setProvince(comp("administrative_area_level_1"));
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
  }, [streetActive]);

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
        <a href="/request" className="btn-secondary inline-block">
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
        return renderGenericField(field, "email", "email");
      case "issue":
        return renderGenericField(field, "issueDescription");
      case "landmark":
        return renderGenericField(field, "landmark");
      case "province":
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
        return <PhotoUpload key={field.id} label={field.label} required={req} />;
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
            <select name="serviceTypeId" required={req} className="input">
              <option value="">Select service type...</option>
              {serviceTypes.map((s) => (
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
              <p className="text-[11px] text-slate-400">Address autocomplete not configured for this demo — enter details manually below.</p>
            )}
            <input type="hidden" name="lat" value={lat ?? ""} />
            <input type="hidden" name="lng" value={lng ?? ""} />
          </div>
        );
      case "city":
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
    <form action={formAction} className="card space-y-5">
      {fields.map((f) => (f.systemKey ? renderSystemField(f) : <DynamicFormField key={f.id} field={f} />))}

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Submitting..." : content.submitButtonLabel}
      </button>
    </form>
  );
}
