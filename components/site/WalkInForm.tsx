"use client";

import { useActionState, useRef, useState } from "react";
import { submitWalkInRequest, sendWalkInOtp, verifyWalkInOtp } from "@/lib/actions";
import { OTP_GATE_ENABLED } from "@/lib/config";
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
  emailAvailable,
}: {
  branches: Pick<Branch, "id" | "name">[];
  brands: Brand[];
  models: Model[];
  serviceTypes: ServiceType[];
  emailAvailable: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitWalkInRequest, undefined);
  const [brandId, setBrandId] = useState("");
  const [showOther, setShowOther] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Email OTP verification — anti-spam gate, run at submit time: the
  // customer fills out the whole form, hits Submit, and only entering the
  // code that arrives by email actually completes the request. Nothing is
  // written to the server until the code is verified. Mirrors Home Service
  // Requests' phone-based OTP gate, but by email since this form has no
  // scheduling/quotation-email machinery to piggyback a phone number off of.
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
    if (!form.reportValidity()) return; // surfaces the browser's native "please fill this in" on any missing required field
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
      {!emailGateActive && (
        <>
          {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Submitting..." : "Pre-Register My Visit"}
          </button>
        </>
      )}

      {emailGateActive && otpStage === "idle" && (
        <>
          <button type="button" onClick={handleProceedToOtp} disabled={sendingOtp} className="btn-primary w-full">
            {sendingOtp ? "Sending verification code..." : "Pre-Register My Visit"}
          </button>
          {otpError && <p className="text-center text-sm text-red-600">{otpError}</p>}
        </>
      )}

      {emailGateActive && otpStage === "sent" && (
        <div className="space-y-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">🔒 Verify your email to complete this request</p>
          <p className="text-sm font-medium text-blue-900">
            Please enter the code we sent by email to {sentEmail}. This will help us ensure that this registration is legitimate and
            requested by a real human.
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
