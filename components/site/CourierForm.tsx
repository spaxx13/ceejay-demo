"use client";

import { useActionState, useState } from "react";
import { submitCourierRequest } from "@/lib/actions";
import { COURIER_AGREEMENT_TERMS, COURIER_PACKING_TIPS } from "@/lib/courierService";
import PhotoUpload from "@/components/PhotoUpload";
import type { Branch } from "@/lib/types";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };

export default function CourierForm({
  branch,
  brands,
  models,
  serviceTypes,
}: {
  branch: Pick<Branch, "id" | "name" | "address">;
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
}) {
  const [state, formAction, pending] = useActionState(submitCourierRequest, undefined);
  const [brandId, setBrandId] = useState("");
  const [agreed, setAgreed] = useState(false);

  if (state?.ok) {
    return (
      <div className="card space-y-4">
        <div className="text-center">
          <p className="text-3xl">📦</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-800">Booking received!</h3>
          <p className="mt-1 text-sm text-slate-400">Your reference number</p>
          <p className="font-mono text-xl font-bold text-slate-900">{state.reference}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">Ship your device to:</p>
          <p>Ceejay Cellphone Repair Shop — {state.branch.name}</p>
          <p>{state.branch.address}</p>
          {state.branch.contactNumber && <p>Contact: {state.branch.contactNumber}</p>}
          <p>Attn: {state.reference}</p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500">
          {COURIER_PACKING_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <a href={`/courier-service/track?reference=${encodeURIComponent(state.reference)}`} className="btn-primary block text-center">
          Track This Request
        </a>
      </div>
    );
  }

  const modelsForBrand = models.filter((m) => m.brandId === brandId);
  const showOther = brandId === "other" || (brandId !== "" && modelsForBrand.length === 0);

  return (
    <form action={formAction} className="card space-y-4">
      <input type="hidden" name="courierAgreed" value={agreed ? "1" : "0"} />
      <h3 className="text-sm font-semibold text-slate-800">Your Details</h3>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Full Name <span className="text-red-600">*</span>
        </label>
        <input name="name" required className="input" placeholder="Juan Dela Cruz" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Mobile Number <span className="text-red-600">*</span>
          </label>
          <input name="phone" required className="input" placeholder="0917 123 4567" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Email <span className="text-red-600">*</span>
          </label>
          <input name="email" type="email" required className="input" placeholder="juan@email.com" />
        </div>
      </div>

      <h3 className="pt-2 text-sm font-semibold text-slate-800">Return Address</h3>
      <p className="-mt-2 text-xs text-slate-400">Where we ship your repaired device back to — anywhere in the Philippines.</p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          House No. / Street <span className="text-red-600">*</span>
        </label>
        <input name="street" required className="input" placeholder="123 Rizal St." />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Barangay</label>
          <input name="barangay" className="input" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            City / Municipality <span className="text-red-600">*</span>
          </label>
          <input name="city" required className="input" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Province <span className="text-red-600">*</span>
          </label>
          <input name="province" required className="input" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">ZIP Code</label>
          <input name="zipCode" inputMode="numeric" maxLength={4} className="input" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Landmark (optional)</label>
        <input name="landmark" className="input" placeholder="e.g. beside the barangay hall" />
      </div>

      <h3 className="pt-2 text-sm font-semibold text-slate-800">Your Device</h3>
      <input type="hidden" name="branchId" value={branch.id} />
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-semibold">You&apos;ll ship your device to:</p>
        <p>Ceejay Cellphone Repair Shop — {branch.name}</p>
        <p>{branch.address}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Device Brand <span className="text-red-600">*</span>
          </label>
          <select name="deviceBrandId" required className="input" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Select brand...</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
            <option value="other">Other — please specify</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Device Model</label>
          {showOther || brandId === "" ? (
            <input name="deviceOther" className="input" placeholder="e.g. iPhone 13" />
          ) : (
            <select name="deviceModelId" className="input" defaultValue="">
              <option value="">Select model...</option>
              {modelsForBrand.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">What needs repair? (optional)</label>
        <select name="serviceTypeId" defaultValue="" className="input">
          <option value="">Not sure yet</option>
          {serviceTypes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Describe the Issue <span className="text-red-600">*</span>
        </label>
        <textarea name="issue" required rows={3} className="input" placeholder="e.g. Won't charge after it got wet" />
      </div>
      <PhotoUpload label="Photo of the Issue (optional)" />

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">Courier Service Agreement</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
          {COURIER_AGREEMENT_TERMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <label className="flex items-start gap-2 text-xs font-medium text-slate-700">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
          <span>I have read and accept the Courier Service Agreement.</span>
        </label>
      </div>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending || !agreed} className="btn-primary w-full">
        {pending ? "Submitting..." : "Book Courier Service"}
      </button>
    </form>
  );
}
