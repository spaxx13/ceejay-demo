"use client";

import { useActionState, useEffect, useState } from "react";
import { checkQuoteAvailability, submitPublicQuote } from "@/lib/actions";
import { PROVINCE_FEES } from "@/lib/homeServiceFees";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };
type Branch = { id: string; name: string; address: string; contactNumber: string };

type MatchState = "idle" | "checking" | "matched" | "unmatched";

const PROVINCES = Object.keys(PROVINCE_FEES);

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
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [screenQuality, setScreenQuality] = useState("");
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [serviceMode, setServiceMode] = useState<"" | "walk_in" | "home_service">("");

  const modelsForBrand = models.filter((m) => m.brandId === brandId);
  const otherBrandSelected = brandId === "other";
  const brandHasNoModels = brandId !== "" && !otherBrandSelected && modelsForBrand.length === 0;
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
    setServiceTypeId("");
    setScreenQuality("");
    setServiceMode("");
  }
  function onModelChange(value: string) {
    setModelId(value);
    setServiceTypeId("");
    setScreenQuality("");
    setServiceMode("");
  }
  function onServiceTypeChange(value: string) {
    setServiceTypeId(value);
    setScreenQuality("");
    setServiceMode("");
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

        {modelId && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Repair Type <span className="text-red-600">*</span>
            </label>
            <select value={serviceTypeId} onChange={(e) => onServiceTypeChange(e.target.value)} className="input">
              <option value="">Select repair type...</option>
              {serviceTypes.map((s) => (
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

          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Service Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setServiceMode("walk_in")}
                className={serviceMode === "walk_in" ? "btn-primary" : "btn-secondary"}
              >
                Walk-in
              </button>
              <button
                type="button"
                onClick={() => setServiceMode("home_service")}
                className={serviceMode === "home_service" ? "btn-primary" : "btn-secondary"}
              >
                Home Service
              </button>
            </div>
            <input type="hidden" name="serviceMode" value={serviceMode} />

            {serviceMode === "walk_in" && (
              <div className="space-y-1.5">
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
              <div className="space-y-3">
                <p className="text-xs text-slate-400">A home service fee applies on top of the repair cost, based on your area.</p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">
                    Street Address <span className="text-red-600">*</span>
                  </label>
                  <input name="street" required className="input" placeholder="House/Unit No., Street" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Barangay</label>
                    <input name="barangay" className="input" placeholder="Barangay" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">
                      City/Municipality <span className="text-red-600">*</span>
                    </label>
                    <input name="city" required className="input" placeholder="City/Municipality" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">
                    Province <span className="text-red-600">*</span>
                  </label>
                  <select name="province" required defaultValue="" className="input">
                    <option value="" disabled>
                      Select a province
                    </option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {serviceMode && (
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
          )}
        </form>
      )}
    </div>
  );
}
