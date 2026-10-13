"use client";

import { useActionState, useEffect, useState } from "react";
import { getInstantHomeQuote } from "@/lib/actions";
import { EXCLUDED_FROM_HOME_SERVICE } from "@/lib/homeServiceFees";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };
type PhCity = { name: string };
type PhProvince = { key: string; label: string; cities: PhCity[] };

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Exact Home Service price on screen + a copy emailed (email required) —
// for the /home-service ad landing page. The price is computed server-side
// (lib/actions.ts getInstantHomeQuote); the selects here only collect input.
export default function InstantQuote({
  brands,
  models,
  serviceTypes,
  bookHref,
}: {
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  bookHref: string;
}) {
  // Remounting the form (new key) is how "Get another quote" clears the
  // previous result — useActionState has no reset of its own.
  const [formKey, setFormKey] = useState(0);
  return <QuoteFormBody key={formKey} brands={brands} models={models} serviceTypes={serviceTypes} bookHref={bookHref} onReset={() => setFormKey((k) => k + 1)} />;
}

function QuoteFormBody({
  brands,
  models,
  serviceTypes,
  bookHref,
  onReset,
}: {
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  bookHref: string;
  onReset: () => void;
}) {
  const [state, formAction, pending] = useActionState(getInstantHomeQuote, undefined);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [screenQuality, setScreenQuality] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  const [phData, setPhData] = useState<PhProvince[] | null>(null);
  useEffect(() => {
    fetch("/ph-addresses-near.json")
      .then((r) => r.json())
      .then(setPhData)
      .catch(() => setPhData([]));
  }, []);
  const selectedProvince = phData?.find((p) => p.label === province) ?? null;

  const modelsForBrand = models.filter((m) => m.brandId === brandId);
  const availableServiceTypes = serviceTypes.filter((s) => !EXCLUDED_FROM_HOME_SERVICE.has(s.label));
  const isScreenRepair = availableServiceTypes.find((s) => s.id === serviceTypeId)?.label === "Screen Repair";

  if (state?.ok) {
    const qualityLabel = state.screenQuality === "original" ? "Original" : state.screenQuality === "high_quality" ? "High Quality (compatible)" : "";
    return (
      <div className="card space-y-3 text-left">
        <p className="text-sm font-semibold text-slate-800">Your Quotation</p>
        <div className="flex items-start justify-between gap-3 text-sm">
          <div>
            <p className="font-medium text-slate-700">{state.deviceLabel}</p>
            <p className="text-xs text-slate-400">
              {state.serviceTypeLabel}
              {qualityLabel ? ` (${qualityLabel})` : ""}
            </p>
          </div>
          <span className="shrink-0 font-medium text-slate-700">{peso(state.repairCost)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
          <span>Home service visit fee</span>
          <span>{state.serviceFee !== null ? peso(state.serviceFee) : "To be confirmed"}</span>
        </div>
        {state.total !== null && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-sm font-semibold text-slate-800">Total</span>
            <span className="text-xl font-bold text-blue-300">{peso(state.total)}</span>
          </div>
        )}
        <p className="text-xs text-slate-400">
          Based on our standard price list. Final pricing is confirmed by our technician before any repair work begins.
        </p>
        {state.downpaymentRequired && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Bookings in your area need a down payment equal to the visit fee to confirm
            {state.sundayOnly ? ", and home service visits there are on Sundays only" : ""}.
          </p>
        )}
        <p className="text-xs text-slate-400">
          {state.emailed ? "We also emailed you a copy of this quotation." : "We couldn't email a copy just now, but the price above is yours to keep."}
        </p>
        <a href={bookHref} className="btn-primary block w-full text-center">
          Continue to booking ↓
        </a>
        <button type="button" onClick={onReset} className="block w-full text-center text-sm text-blue-500 hover:underline">
          Get another quote
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 text-left">
      <input type="hidden" name="deviceBrandId" value={brandId} />
      <input type="hidden" name="deviceModelId" value={modelId} />
      <input type="hidden" name="serviceTypeId" value={serviceTypeId} />
      <input type="hidden" name="screenQuality" value={screenQuality} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Brand <span className="text-red-600">*</span>
          </label>
          <select
            required
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setModelId("");
            }}
            className="input"
          >
            <option value="">Select brand...</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Model <span className="text-red-600">*</span>
          </label>
          <select required value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!brandId} className="input">
            <option value="">{brandId ? "Select model..." : "Select brand first"}</option>
            {modelsForBrand.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Repair <span className="text-red-600">*</span>
        </label>
        <select
          required
          value={serviceTypeId}
          onChange={(e) => {
            setServiceTypeId(e.target.value);
            setScreenQuality("");
          }}
          className="input"
        >
          <option value="">Select repair...</option>
          {availableServiceTypes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {isScreenRepair && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Screen quality <span className="text-red-600">*</span>
          </label>
          <select required value={screenQuality} onChange={(e) => setScreenQuality(e.target.value)} className="input">
            <option value="">Select quality...</option>
            <option value="original">Original</option>
            <option value="high_quality">High Quality (compatible)</option>
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Province <span className="text-red-600">*</span>
          </label>
          <select
            name="province"
            required
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setCity("");
            }}
            disabled={!phData}
            className="input"
          >
            <option value="">{phData ? "Select province..." : "Loading..."}</option>
            {(phData ?? []).map((p) => (
              <option key={p.key} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            City <span className="text-red-600">*</span>
          </label>
          <select name="city" required value={city} onChange={(e) => setCity(e.target.value)} disabled={!selectedProvince} className="input">
            <option value="">Select city...</option>
            {(selectedProvince?.cities ?? []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Email <span className="text-red-600">*</span>
        </label>
        <input name="email" type="email" required className="input" placeholder="juan@email.com" />
        <p className="text-[11px] text-slate-400">We&apos;ll email you a copy of your quotation.</p>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Getting your price..." : "Show my price"}
      </button>
    </form>
  );
}
