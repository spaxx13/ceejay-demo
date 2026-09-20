"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { submitMailInRequest, sendWalkInOtp, verifyWalkInOtp } from "@/lib/actions";
import { OTP_GATE_ENABLED } from "@/lib/config";
import PhotoUpload from "@/components/PhotoUpload";
import type { Branch } from "@/lib/types";

type Brand = { id: string; label: string };
type Model = { id: string; brandId: string; name: string };
type ServiceType = { id: string; label: string };

export default function MailInForm({
  branches,
  brands,
  models,
  serviceTypes,
  emailAvailable,
}: {
  branches: Pick<Branch, "id" | "name" | "address">[];
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  emailAvailable: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitMailInRequest, undefined);
  const [brandId, setBrandId] = useState("");
  const [showOther, setShowOther] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Email OTP anti-spam gate — same flow as the Walk-In form (reuses its
  // sendWalkInOtp/verifyWalkInOtp): nothing is saved until the code that
  // arrives by email is verified.
  const [otpStage, setOtpStage] = useState<"idle" | "sent">("idle");
  const [sentEmail, setSentEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const emailGateActive = OTP_GATE_ENABLED && emailAvailable;

  async function handleProceedToOtp() {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    const email = String(new FormData(form).get("email") ?? "").trim();
    setOtpError("");
    setSendingOtp(true);
    try {
      const res = await sendWalkInOtp(email);
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
      const res = await sendWalkInOtp(sentEmail);
      if (res.ok) setOtpCode("");
      else setOtpError(res.error);
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

  if (state?.ok) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-3xl">📦</p>
        <h3 className="text-lg font-semibold text-slate-800">Request received!</h3>
        <p className="text-sm text-slate-400">
          We&apos;re reviewing your request. <strong>Please don&apos;t ship your phone yet</strong> — we&apos;ll email you once it&apos;s approved, with
          the address to ship to. You can check the status anytime on your tracking page (we also emailed you the link).
        </p>
        <p className="font-mono text-xs text-slate-400">Reference: {state.reference}</p>
        <Link href={`/mail-in/track/${state.token}`} className="btn-primary inline-block">
          Check My Request Status
        </Link>
      </div>
    );
  }

  const modelsForBrand = models.filter((m) => m.brandId === brandId);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4">
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
          <label className="text-xs font-medium text-slate-500">
            Email <span className="text-red-600">*</span>
          </label>
          <input name="email" type="email" required className="input" placeholder="juan@email.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Which branch will you ship to? <span className="text-red-600">*</span>
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

      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Return address</p>
          <p className="text-xs text-slate-400">Where we&apos;ll ship your phone back after the repair.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            House/Unit No. &amp; Street <span className="text-red-600">*</span>
          </label>
          <input name="returnStreet" required className="input" placeholder="123 Rizal St." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Barangay</label>
            <input name="returnBarangay" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              City / Municipality <span className="text-red-600">*</span>
            </label>
            <input name="returnCity" required className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              Province <span className="text-red-600">*</span>
            </label>
            <input name="returnProvince" required className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Landmark</label>
            <input name="returnLandmark" className="input" />
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-500">
        <input type="checkbox" name="agree" required className="mt-0.5" />
        <span>
          I understand I pay the courier fee for shipping my phone to the shop and back, that I pay for the repair only after it&apos;s done,
          and that I should remove my SIM/memory card and turn off Find My / screen lock where possible.
        </span>
      </label>

      {!emailGateActive && (
        <>
          {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Submitting..." : "Submit Repair Request"}
          </button>
        </>
      )}

      {emailGateActive && otpStage === "idle" && (
        <>
          <button type="button" onClick={handleProceedToOtp} disabled={sendingOtp} className="btn-primary w-full">
            {sendingOtp ? "Sending verification code..." : "Submit Repair Request"}
          </button>
          {otpError && <p className="text-center text-sm text-red-600">{otpError}</p>}
        </>
      )}

      {emailGateActive && otpStage === "sent" && (
        <div className="space-y-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">🔒 Verify your email to complete this request</p>
          <p className="text-sm font-medium text-blue-900">
            Please enter the code we sent by email to {sentEmail}. This helps us make sure this request is from a real person.
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
          {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
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
