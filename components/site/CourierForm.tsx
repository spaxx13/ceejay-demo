"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitCourierRequest, sendWalkInOtp, verifyWalkInOtp } from "@/lib/actions";
import { OTP_GATE_ENABLED } from "@/lib/config";
import {
  COURIER_AGREEMENT_TERMS,
  COURIER_LIST,
  COURIER_PACKING_TIPS,
  COURIER_SELF_SHIP_NOTICE,
  COURIER_TRACKING_REMINDER,
  SELF_BOOK_AGREEMENT_TERMS,
  SELF_BOOK_LINKS,
  SELF_BOOK_NOTICE,
  SELF_BOOK_PACKING_TIPS,
  SELF_BOOK_TRACKING_REMINDER,
} from "@/lib/courierService";
import PhotoUpload from "@/components/PhotoUpload";
import type { Branch, CourierDeliveryMode } from "@/lib/types";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };
// public/ph-addresses-all.json (scripts/build-ph-addresses-all.py)
type PhProvince = { key: string; label: string; cities: { name: string; barangays: string[] }[] };

export default function CourierForm({
  branch,
  brands,
  models,
  serviceTypes,
  emailAvailable,
  mode = "courier",
}: {
  branch: Pick<Branch, "id" | "name" | "address">;
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  emailAvailable: boolean;
  // "self_book" = Pickup & Delivery option 2: the customer books their own
  // Lalamove / Grab driver both ways. Same request, different wording.
  mode?: CourierDeliveryMode;
}) {
  const selfBook = mode === "self_book";
  const [state, formAction, pending] = useActionState(submitCourierRequest, undefined);
  const [brandId, setBrandId] = useState("");
  const [agreed, setAgreed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Email OTP — anti-spam gate run at submit time, same as the walk-in form:
  // the customer fills out the form, then enters the code emailed to them,
  // and only then is the booking written. (The OTP actions are the shared
  // email ones; they're named for the walk-in form they were built for.)
  const [otpStage, setOtpStage] = useState<"idle" | "sent">("idle");
  const [sentEmail, setSentEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const emailGateActive = OTP_GATE_ENABLED && emailAvailable;

  async function sendCode(email: string, firstTime: boolean) {
    setOtpError("");
    setSendingOtp(true);
    try {
      const res = await sendWalkInOtp(email);
      if (res.ok) {
        if (firstTime) setSentEmail(email);
        setOtpCode("");
        if (firstTime) setOtpStage("sent");
      } else {
        setOtpError(res.error);
      }
    } catch {
      setOtpError("Something went wrong sending the code — please try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  function handleProceedToOtp() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return; // surfaces the browser's native "please fill this in"
    // The photo goes through a hidden field the browser can't validate.
    if (!String(new FormData(form).get("photoDataUrl") ?? "")) {
      setOtpError("Please upload a photo of your device.");
      return;
    }
    void sendCode(String(new FormData(form).get("email") ?? "").trim(), true);
  }

  async function handleVerifyAndSubmit() {
    setOtpError("");
    setVerifyingOtp(true);
    try {
      const res = await verifyWalkInOtp(sentEmail, otpCode);
      if (!res.ok) {
        setOtpError(res.error);
        return;
      }
      const form = formRef.current;
      if (!form) return;
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

  // Every province / city / barangay in the Philippines, loaded on demand.
  // If it can't load, or the customer's address isn't in the list, the same
  // three fields fall back to plain text inputs.
  const [phData, setPhData] = useState<PhProvince[] | null>(null);
  const [typed, setTyped] = useState(false);
  const [provinceKey, setProvinceKey] = useState("");
  const [city, setCity] = useState("");
  useEffect(() => {
    fetch("/ph-addresses-all.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPhData)
      .catch(() => setTyped(true));
  }, []);
  const province = phData?.find((p) => p.key === provinceKey) ?? null;
  const cityEntry = province?.cities.find((c) => c.name === city) ?? null;

  if (state?.ok) {
    return (
      <div className="card space-y-4">
        <div className="text-center">
          <p className="text-3xl">📦</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-800">Booking received!</h3>
          <p className="mt-1 text-sm text-slate-400">Your reference number</p>
          <p className="font-mono text-xl font-bold text-slate-900">{state.reference}</p>
        </div>
        {selfBook && state.handoverCode && (
          <div className="rounded-lg border-2 border-slate-800 bg-white p-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hand-over code</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-slate-900">{state.handoverCode}</p>
            <p className="mt-1 text-xs text-slate-500">
              I-save ito. Hihingin ng branch ang code na ito at ang plate number ng driver bago ilabas ang device mo. Naka-email din ito sa iyo.
            </p>
          </div>
        )}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">{selfBook ? "Drop-off address para sa driver mo:" : "Ship your device to:"}</p>
          <p>Ceejay Cellphone Repair Shop — {state.branch.name}</p>
          <p>{state.branch.address}</p>
          {state.branch.contactNumber && <p>Contact: {state.branch.contactNumber}</p>}
          <p>{selfBook ? "Sa notes ng booking ilagay:" : "Attn:"} {state.reference}</p>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">{selfBook ? SELF_BOOK_NOTICE : COURIER_SELF_SHIP_NOTICE}</p>
          {selfBook ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {SELF_BOOK_LINKS.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-1.5 text-xs">
                  Mag-book sa {l.label}
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2">
              <span className="font-semibold">Couriers na pwede mong gamitin:</span> {COURIER_LIST.join(", ")}
            </p>
          )}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500">
          {(selfBook ? SELF_BOOK_PACKING_TIPS : COURIER_PACKING_TIPS).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="rounded-lg border-2 border-blue-400 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">{selfBook ? "📍 Huwag kalimutan: ilagay ang booking details" : "📦 Huwag kalimutan: ilagay ang tracking number"}</p>
          <p className="mt-1">{selfBook ? SELF_BOOK_TRACKING_REMINDER : COURIER_TRACKING_REMINDER}</p>
        </div>
        <a href={`/courier-service/track?reference=${encodeURIComponent(state.reference)}`} className="btn-primary block text-center">
          {selfBook ? "Track This Request & Enter Your Booking Details" : "Track This Request & Enter Your Tracking Number"}
        </a>
      </div>
    );
  }

  const modelsForBrand = models.filter((m) => m.brandId === brandId);
  const showOther = brandId === "other" || (brandId !== "" && modelsForBrand.length === 0);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4">
      <input type="hidden" name="courierAgreed" value={agreed ? "1" : "0"} />
      <input type="hidden" name="deliveryMode" value={mode} />
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
      <p className="-mt-2 text-xs text-slate-400">
        {selfBook
          ? "Where your driver delivers the repaired device. Lalamove at Grab ay sa loob lang ng service area nila."
          : "Where we ship your repaired device back to — anywhere in the Philippines."}
      </p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          House No. / Street <span className="text-red-600">*</span>
        </label>
        <input name="street" required className="input" placeholder="123 Rizal St." />
      </div>
      {typed ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Province <span className="text-red-600">*</span>
            </label>
            <input name="province" required className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              City / Municipality <span className="text-red-600">*</span>
            </label>
            <input name="city" required className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Barangay</label>
            <input name="barangay" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">ZIP Code</label>
            <input name="zipCode" inputMode="numeric" maxLength={4} className="input" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Province <span className="text-red-600">*</span>
            </label>
            <input type="hidden" name="province" value={province?.label ?? ""} />
            <select
              required
              className="input"
              disabled={!phData}
              value={provinceKey}
              onChange={(e) => {
                setProvinceKey(e.target.value);
                setCity("");
              }}
            >
              <option value="">{phData ? "Select province..." : "Loading..."}</option>
              {(phData ?? []).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              City / Municipality <span className="text-red-600">*</span>
            </label>
            <select name="city" required className="input" disabled={!province} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">{province ? "Select city / municipality..." : "Select a province first"}</option>
              {(province?.cities ?? []).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Barangay</label>
            <select key={`${provinceKey}-${city}`} name="barangay" className="input" disabled={!cityEntry} defaultValue="">
              <option value="">{cityEntry ? "Select barangay..." : "Select a city first"}</option>
              {(cityEntry?.barangays ?? []).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">ZIP Code</label>
            <input name="zipCode" inputMode="numeric" maxLength={4} className="input" />
          </div>
        </div>
      )}
      {phData && (
        <button type="button" onClick={() => setTyped(!typed)} className="-mt-2 text-xs text-blue-500 hover:underline">
          {typed ? "← Choose from the list instead" : "My address isn't listed — type it instead"}
        </button>
      )}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Landmark (optional)</label>
        <input name="landmark" className="input" placeholder="e.g. beside the barangay hall" />
      </div>

      <h3 className="pt-2 text-sm font-semibold text-slate-800">Your Device</h3>
      <input type="hidden" name="branchId" value={branch.id} />
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-semibold">{selfBook ? "Your Lalamove / Grab driver brings the device to:" : "You\u2019ll ship your device to:"}</p>
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
      <PhotoUpload label="Photo of Your Device" required />

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">{selfBook ? "Book-Your-Own-Driver Agreement" : "Courier Service Agreement"}</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
          {(selfBook ? SELF_BOOK_AGREEMENT_TERMS : COURIER_AGREEMENT_TERMS).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <label className="flex items-start gap-2 text-xs font-medium text-slate-700">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
          <span>I have read and accept the {selfBook ? "Book-Your-Own-Driver Agreement" : "Courier Service Agreement"}.</span>
        </label>
      </div>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {!emailGateActive && (
        <button type="submit" disabled={pending || !agreed} className="btn-primary w-full">
          {pending ? "Submitting..." : selfBook ? "Submit Request" : "Book Courier Service"}
        </button>
      )}

      {emailGateActive && otpStage === "idle" && (
        <>
          <button type="button" onClick={handleProceedToOtp} disabled={sendingOtp || !agreed} className="btn-primary w-full">
            {sendingOtp ? "Sending verification code..." : selfBook ? "Submit Request" : "Book Courier Service"}
          </button>
          {otpError && <p className="text-center text-sm text-red-600">{otpError}</p>}
        </>
      )}

      {emailGateActive && otpStage === "sent" && (
        <div className="space-y-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">🔒 Verify your email to complete this booking</p>
          <p className="text-sm font-medium text-blue-900">
            Enter the code we sent by email to {sentEmail}. This helps us make sure the booking is from a real person.
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
            <button type="button" onClick={() => void sendCode(sentEmail, false)} disabled={sendingOtp} className="font-medium text-blue-700 hover:underline">
              {sendingOtp ? "Resending..." : "Resend code"}
            </button>
            <button type="button" onClick={() => setOtpStage("idle")} className="text-slate-500 hover:underline">
              ← Edit booking details
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
