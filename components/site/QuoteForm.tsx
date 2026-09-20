"use client";

import { useActionState, useEffect, useState } from "react";
import { checkQuoteAvailability, submitPublicQuote } from "@/lib/actions";
import { EXCLUDED_FROM_HOME_SERVICE } from "@/lib/homeServiceFees";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };
type Branch = { id: string; name: string; address: string; contactNumber: string };
type PhCity = { name: string; barangays: string[] };
type PhProvince = { key: string; label: string; cities: PhCity[] };

type MatchState = "idle" | "checking" | "matched" | "unmatched";

function BranchList({ branches }: { branches: Branch[] }) {
  return (
    <div className="space-y-2">
      {branches.map((b) => (
        <div key={b.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">{b.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">{b.address}</p>
          <p className="mt-1 text-xs text-blue-300">{b.contactNumber}</p>
        </div>
      ))}
    </div>
  );
}

export default function QuoteForm({
  brands,
  models,
  serviceTypes,
  branches,
}: {
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  branches: Branch[];
}) {
  const [state, formAction, pending] = useActionState(submitPublicQuote, undefined);

  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [serviceMode, setServiceMode] = useState<"" | "walk_in" | "home_service">("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [screenQuality, setScreenQuality] = useState("");
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [barangay, setBarangay] = useState("");

  // Same PSGC-derived "near" queue dataset (all 8 provinces) the real Home
  // Service form offers — Quezon and Rizal have no flat fee on file
  // (PROVINCE_FEES), so their quoted fee falls back to "To be confirmed"
  // (see sendPublicQuoteEmail), but they're still bookable, so still shown
  // here rather than silently dropped.
  const [phData, setPhData] = useState<PhProvince[] | null>(null);
  useEffect(() => {
    fetch("/ph-addresses-near.json")
      .then((r) => r.json())
      .then(setPhData)
      .catch(() => setPhData([]));
  }, []);
  const availableProvinces = phData ?? [];
  const selectedPhProvince = phData?.find((p) => p.label === province) ?? null;
  const selectedPhCity = selectedPhProvince?.cities.find((c) => c.name === city) ?? null;

  const modelsForBrand = models.filter((m) => m.brandId === brandId);
  const otherBrandSelected = brandId === "other";
  const brandHasNoModels = brandId !== "" && !otherBrandSelected && modelsForBrand.length === 0;

  // Home Service only covers repairs a technician can do in the field —
  // same exclusion list the real Home Service booking form (/request)
  // uses, so the two can never disagree about what's bookable at home.
  const availableServiceTypes =
    serviceMode === "home_service" ? serviceTypes.filter((s) => !EXCLUDED_FROM_HOME_SERVICE.has(s.label)) : serviceTypes;

  const selectedServiceType = serviceTypes.find((s) => s.id === serviceTypeId);
  const isScreenRepair = selectedServiceType?.label === "Screen Repair";
  const repairSelectionComplete = Boolean(modelId && serviceTypeId && (!isScreenRepair || screenQuality));

  useEffect(() => {
    if (otherBrandSelected || brandHasNoModels) {
      setMatchState("unmatched");
      return;
    }
    if (!repairSelectionComplete) {
      setMatchState("idle");
      return;
    }
    let cancelled = false;
    setMatchState("checking");
    checkQuoteAvailability(modelId, serviceTypeId, screenQuality || undefined).then((res) => {
      if (!cancelled) setMatchState(res.matched ? "matched" : "unmatched");
    });
    return () => {
      cancelled = true;
    };
  }, [otherBrandSelected, brandHasNoModels, repairSelectionComplete, modelId, serviceTypeId, screenQuality]);

  function onBrandChange(value: string) {
    setBrandId(value);
    setModelId("");
    setServiceMode("");
    setServiceTypeId("");
    setScreenQuality("");
  }
  function onModelChange(value: string) {
    setModelId(value);
    setServiceMode("");
    setServiceTypeId("");
    setScreenQuality("");
  }
  function onServiceModeChange(value: "walk_in" | "home_service") {
    setServiceMode(value);
    setServiceTypeId("");
    setScreenQuality("");
    setProvince("");
    setCity("");
    setBarangay("");
  }
  function onServiceTypeChange(value: string) {
    setServiceTypeId(value);
    setScreenQuality("");
  }

  if (state?.ok) {
    return (
      <div className="card space-y-2 text-center">
        <p className="text-3xl">✅</p>
        <h3 className="text-lg font-semibold text-slate-800">Quotation sent!</h3>
        <p className="text-sm text-slate-400">Check your email for the price breakdown — we&apos;ve sent it to the address you entered.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Device Brand <span className="text-red-600">*</span>
            </label>
            <select value={brandId} onChange={(e) => onBrandChange(e.target.value)} className="input">
              <option value="">Select brand...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Device Model <span className="text-red-600">*</span>
            </label>
            <select
              value={modelId}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={!brandId || otherBrandSelected || brandHasNoModels}
              className="input"
            >
              <option value="">{brandId && !otherBrandSelected ? "Select model..." : "Select brand first"}</option>
              {modelsForBrand.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {modelId && !otherBrandSelected && !brandHasNoModels && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Service Type <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onServiceModeChange("walk_in")}
                className={serviceMode === "walk_in" ? "btn-primary" : "btn-secondary"}
              >
                Walk-in
              </button>
              <button
                type="button"
                onClick={() => onServiceModeChange("home_service")}
                className={serviceMode === "home_service" ? "btn-primary" : "btn-secondary"}
              >
                Home Service
              </button>
            </div>
          </div>
        )}

        {serviceMode && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Repair Type <span className="text-red-600">*</span>
            </label>
            <select value={serviceTypeId} onChange={(e) => onServiceTypeChange(e.target.value)} className="input">
              <option value="">Select repair type...</option>
              {availableServiceTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {isScreenRepair && serviceTypeId && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Screen Quality <span className="text-red-600">*</span>
            </label>
            <select value={screenQuality} onChange={(e) => setScreenQuality(e.target.value)} className="input">
              <option value="">Select quality...</option>
              <option value="original">Original</option>
              <option value="high_quality">High Quality (compatible)</option>
            </select>
          </div>
        )}

        {matchState === "checking" && <p className="text-xs text-slate-400">Checking price availability...</p>}
      </div>

      {matchState === "unmatched" && (
        <div className="card space-y-3">
          <p className="text-sm font-medium text-amber-700">Please contact your nearest branch for a custom quote.</p>
          <BranchList branches={branches} />
        </div>
      )}

      {matchState === "matched" && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="deviceBrandId" value={brandId} />
          <input type="hidden" name="deviceModelId" value={modelId} />
          <input type="hidden" name="serviceTypeId" value={serviceTypeId} />
          <input type="hidden" name="screenQuality" value={screenQuality} />
          <input type="hidden" name="serviceMode" value={serviceMode} />

          {serviceMode === "walk_in" && (
            <div className="card space-y-1.5">
              <label className="text-xs font-medium text-slate-500">
                Preferred Branch <span className="text-red-600">*</span>
              </label>
              <select name="branchId" required defaultValue="" className="input">
                <option value="" disabled>
                  Select a branch
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {serviceMode === "home_service" && (
            <div className="card space-y-3">
              <p className="text-xs text-slate-400">A home service fee applies on top of the repair cost, based on your area.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">
                  Street Address <span className="text-red-600">*</span>
                </label>
                <input name="street" required className="input" placeholder="House/Unit No., Street" />
              </div>
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
                    setBarangay("");
                  }}
                  disabled={!phData}
                  className="input"
                >
                  <option value="">{phData ? "Select a province" : "Loading..."}</option>
                  {availableProvinces.map((p) => (
                    <option key={p.key} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">
                  City/Municipality <span className="text-red-600">*</span>
                </label>
                <select
                  name="city"
                  required
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setBarangay("");
                  }}
                  disabled={!selectedPhProvince}
                  className="input"
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
                <label className="text-xs font-medium text-slate-500">Barangay</label>
                <select
                  name="barangay"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  disabled={!selectedPhCity}
                  className="input"
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
          )}

          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Your Contact Details</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Full Name</label>
              <input name="name" className="input" placeholder="Juan Dela Cruz" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">
                  Email <span className="text-red-600">*</span>
                </label>
                <input name="email" type="email" required className="input" placeholder="juan@email.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">
                  Mobile Number <span className="text-red-600">*</span>
                </label>
                <input name="phone" required className="input" placeholder="0917 123 4567" />
              </div>
            </div>
            {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Sending..." : "Email Me This Quote"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
