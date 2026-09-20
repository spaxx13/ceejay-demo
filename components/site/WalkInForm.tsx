"use client";

import { useActionState, useState } from "react";
import { submitWalkInRequest } from "@/lib/actions";
import PhotoUpload from "@/components/PhotoUpload";
import type { Branch } from "@/lib/types";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };

export default function WalkInForm({
  branches,
  brands,
  models,
  serviceTypes,
}: {
  branches: Pick<Branch, "id" | "name">[];
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
}) {
  const [state, formAction, pending] = useActionState(submitWalkInRequest, undefined);
  const [brandId, setBrandId] = useState("");
  const [showOther, setShowOther] = useState(false);

  if (state?.ok) {
    return (
      <div className="card space-y-2 text-center">
        <p className="text-3xl">✅</p>
        <h3 className="text-lg font-semibold text-slate-800">You&apos;re on our list!</h3>
        <p className="text-sm text-slate-400">
          We&apos;ve noted your device and issue so the branch can be ready for you. See you soon — no appointment needed, just walk in.
        </p>
        <p className="font-mono text-xs text-slate-400">Reference: {state.reference}</p>
      </div>
    );
  }

  const modelsForBrand = models.filter((m) => m.brandId === brandId);

  return (
    <form action={formAction} className="card space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Full Name <span className="text-red-600">*</span>
        </label>
        <input name="name" required className="input" placeholder="Juan Dela Cruz" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Mobile Number <span className="text-red-600">*</span>
          </label>
          <input name="phone" required className="input" placeholder="0917 123 4567" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Email</label>
          <input name="email" type="email" className="input" placeholder="juan@email.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Which branch will you visit? <span className="text-red-600">*</span>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            Device Brand <span className="text-red-600">*</span>
          </label>
          <select
            name="deviceBrandId"
            required
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Device Model</label>
          {showOther || modelsForBrand.length === 0 ? (
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
        <textarea name="issue" required rows={3} className="input" placeholder="e.g. Screen cracked after it was dropped" />
      </div>
      <PhotoUpload label="Photo of the Issue (optional)" />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">When do you plan to visit? (optional)</label>
        <input name="preferredDate" type="date" className="input" />
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Submitting..." : "Pre-Register My Visit"}
      </button>
    </form>
  );
}
