"use client";

import { useActionState, useRef, useState } from "react";
import { submitPublicQuotation } from "@/lib/actions";
import { getRepairQuote } from "@/lib/servicePricing";
import { PROVINCE_FEES, serviceFeeAmount } from "@/lib/homeServiceFees";
import { EXCLUDED_FROM_HOME_SERVICE } from "./HomeServiceForm";
import type { ServicePrice } from "@/lib/types";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };
type Branch = { id: string; name: string };

type ItemState = { key: number; brandId: string; deviceModelId: string; serviceTypeId: string; screenQuality: string; backHousingColor: string };

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PROVINCES_WITH_FEE = Object.keys(PROVINCE_FEES);

export default function QuotationForm({
  brands,
  models,
  serviceTypes,
  prices,
  branches,
}: {
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  prices: ServicePrice[];
  branches: Branch[];
}) {
  const [state, formAction, pending] = useActionState(submitPublicQuotation, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const [deliveryMethod, setDeliveryMethod] = useState<"" | "home_service" | "walk_in">("");
  const [province, setProvince] = useState("");
  const [provinceOther, setProvinceOther] = useState("");
  const [city, setCity] = useState("");
  const [branchId, setBranchId] = useState("");

  const nextKeyRef = useRef(1);
  const [items, setItems] = useState<ItemState[]>([{ key: 0, brandId: "", deviceModelId: "", serviceTypeId: "", screenQuality: "", backHousingColor: "" }]);
  function addItem() {
    setItems((it) => [...it, { key: nextKeyRef.current++, brandId: "", deviceModelId: "", serviceTypeId: "", screenQuality: "", backHousingColor: "" }]);
  }
  function removeItem(key: number) {
    setItems((it) => (it.length > 1 ? it.filter((x) => x.key !== key) : it));
  }
  function updateItem(key: number, patch: Partial<ItemState>) {
    setItems((it) => it.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  const effectiveProvince = province === "Other" ? provinceOther : province;
  const fee = deliveryMethod === "home_service" ? serviceFeeAmount(effectiveProvince, city) : null;

  function itemPrice(item: ItemState): number | null {
    const serviceType = serviceTypes.find((s) => s.id === item.serviceTypeId);
    if (!serviceType || !item.deviceModelId) return null;
    return getRepairQuote(prices, serviceType.label, item.deviceModelId, item.screenQuality);
  }

  const subtotal = items.reduce((sum, it) => sum + (itemPrice(it) ?? 0), 0);
  const allPricesKnown = items.every((it) => itemPrice(it) !== null);
  const total = allPricesKnown ? subtotal + (fee ?? 0) : null;

  if (state?.ok) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-lg font-semibold text-slate-800">Your quotation is ready</h2>
        <p className="text-sm text-slate-400">
          Reference number
          <br />
          <span className="font-mono text-base font-semibold text-blue-300">{state.reference}</span>
        </p>
        {state.emailSent ? (
          <p className="text-sm text-slate-400">We&apos;ve emailed your quotation, including the estimated total, as a PDF.</p>
        ) : (
          <p className="text-sm text-red-600">
            Your quotation was saved, but the email couldn&apos;t be sent right now. Please contact a branch with reference{" "}
            <span className="font-semibold">{state.reference}</span> to get a copy.
          </p>
        )}
        <a href="/quote" className="btn-secondary inline-block">
          Get another quotation
        </a>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="card space-y-5">
      <input type="hidden" name="itemCount" value={items.length} />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          How would you like this repair done? <span className="text-red-600">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDeliveryMethod("home_service")}
            className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              deliveryMethod === "home_service" ? "border-blue-300 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            Home Service
          </button>
          <button
            type="button"
            onClick={() => setDeliveryMethod("walk_in")}
            className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              deliveryMethod === "walk_in" ? "border-blue-300 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            Walk-in / Branch
          </button>
        </div>
        <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
      </div>

      {deliveryMethod === "home_service" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Province <span className="text-red-600">*</span>
            </label>
            <select name={province === "Other" ? undefined : "province"} required className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">Select province...</option>
              {PROVINCES_WITH_FEE.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
            {province === "Other" && (
              <input
                name="province"
                required
                className="input"
                placeholder="Type your province"
                value={provinceOther}
                onChange={(e) => setProvinceOther(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              City/Municipality <span className="text-red-600">*</span>
            </label>
            <input name="city" required className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Quezon City" />
          </div>
          {fee !== null && (
            <p className="col-span-2 text-xs text-slate-400">A flat home service fee of {peso(fee)} applies for this area.</p>
          )}
        </div>
      )}

      {deliveryMethod === "walk_in" && branches.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Preferred Branch (optional)</label>
          <select name="branchId" className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">No preference</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {deliveryMethod && (
        <div className="space-y-3">
          {items.map((item, index) => {
            const modelsForBrand = models.filter((m) => m.brandId === item.brandId);
            const serviceType = serviceTypes.find((s) => s.id === item.serviceTypeId);
            const availableServiceTypes =
              deliveryMethod === "home_service" ? serviceTypes.filter((s) => !EXCLUDED_FROM_HOME_SERVICE.has(s.label)) : serviceTypes;
            const price = itemPrice(item);

            return (
              <div key={item.key} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Item {index + 1}</h3>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(item.key)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">
                    Device Brand <span className="text-red-600">*</span>
                  </label>
                  <select
                    name={`deviceBrandId_${index}`}
                    required
                    className="input"
                    value={item.brandId}
                    onChange={(e) => updateItem(item.key, { brandId: e.target.value, deviceModelId: "" })}
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
                    Device Model <span className="text-red-600">*</span>
                  </label>
                  <select
                    name={`deviceModelId_${index}`}
                    required
                    className="input"
                    value={item.deviceModelId}
                    onChange={(e) => updateItem(item.key, { deviceModelId: e.target.value })}
                    disabled={!item.brandId}
                  >
                    <option value="">Select model...</option>
                    {modelsForBrand.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">
                    Service Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    name={`serviceTypeId_${index}`}
                    required
                    className="input"
                    value={item.serviceTypeId}
                    onChange={(e) => updateItem(item.key, { serviceTypeId: e.target.value, screenQuality: "", backHousingColor: "" })}
                  >
                    <option value="">Select service type...</option>
                    {availableServiceTypes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {serviceType?.label === "Screen Repair" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">
                      Screen Quality <span className="text-red-600">*</span>
                    </label>
                    <select
                      name={`screenQuality_${index}`}
                      required
                      className="input"
                      value={item.screenQuality}
                      onChange={(e) => updateItem(item.key, { screenQuality: e.target.value })}
                    >
                      <option value="">Select quality...</option>
                      <option value="original">Original</option>
                      <option value="high_quality">High Quality (compatible)</option>
                    </select>
                  </div>
                )}

                {serviceType?.label === "Back Housing (whole shell)" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">
                      Back Housing Color <span className="text-red-600">*</span>
                    </label>
                    <input
                      name={`backHousingColor_${index}`}
                      required
                      className="input"
                      placeholder="e.g. Space Gray, Midnight Green"
                      value={item.backHousingColor}
                      onChange={(e) => updateItem(item.key, { backHousingColor: e.target.value })}
                    />
                  </div>
                )}

                <p className="text-sm font-semibold text-slate-700">
                  Estimated cost: <span className="text-blue-300">{price !== null ? peso(price) : "Confirmed upon inspection"}</span>
                </p>
              </div>
            );
          })}
          <button type="button" onClick={addItem} className="btn-secondary w-full text-sm">
            + Add Another Item
          </button>
        </div>
      )}

      {deliveryMethod && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
          <div className="flex items-center justify-between text-sm text-blue-900">
            <span>Items Subtotal</span>
            <span>{peso(subtotal)}</span>
          </div>
          {deliveryMethod === "home_service" && (
            <div className="mt-1 flex items-center justify-between text-sm text-blue-900">
              <span>Service Fee</span>
              <span>{fee !== null ? peso(fee) : "To be confirmed"}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-blue-200 pt-2 text-base font-bold text-blue-900">
            <span>Estimated Total</span>
            <span>{total !== null ? peso(total) : "Confirmed upon inspection"}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Full Name <span className="text-red-600">*</span>
          </label>
          <input name="name" required className="input" placeholder="Juan Dela Cruz" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Mobile Number</label>
          <input name="phone" className="input" placeholder="0917 123 4567" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-slate-500">
            Email Address <span className="text-red-600">*</span>
          </label>
          <input type="email" name="email" required className="input" placeholder="you@example.com" />
          <p className="text-xs text-slate-400">We&apos;ll email your quotation (with the estimated total) to this address.</p>
        </div>
      </div>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending || !deliveryMethod} className="btn-primary w-full">
        {pending ? "Sending your quotation..." : "Email Me My Quotation"}
      </button>
    </form>
  );
}
