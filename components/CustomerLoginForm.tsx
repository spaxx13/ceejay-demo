"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendHomeServiceOtp } from "@/lib/actions";
import { completeCustomerLogin, customerExistsByPhone } from "@/lib/customerActions";

type Stage = "phone" | "otp";

// Phone-OTP login/registration for the customer app — no password. A
// returning customer just verifies their phone; a first-time one also
// gives their name so completeCustomerLogin can create their account.
export default function CustomerLoginForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode() {
    setError("");
    setSending(true);
    try {
      const exists = await customerExistsByPhone(phone);
      setIsNewCustomer(!exists);
      const res = await sendHomeServiceOtp(phone);
      if (res.ok) {
        setCode("");
        setStage("otp");
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong sending the code — please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    setError("");
    setVerifying(true);
    try {
      const res = await completeCustomerLogin(phone, code, name);
      if (res.ok) {
        router.push("/my");
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong signing you in — please try again.");
    } finally {
      setVerifying(false);
    }
  }

  if (stage === "phone") {
    return (
      <div className="card space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Mobile Number</label>
          <input
            type="text"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0917 123 4567"
            className="input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" onClick={handleSendCode} disabled={sending || !phone} className="btn-primary w-full">
          {sending ? "Sending code…" : "Send Verification Code"}
        </button>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <p className="text-sm text-slate-600">
        Enter the 6-digit code we sent to <span className="font-semibold">{phone}</span>.
      </p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Verification Code</label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit code"
          className="input"
        />
      </div>
      {isNewCustomer && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Your Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" className="input" />
          <p className="text-xs text-slate-400">First time booking with us? We just need your name to set up your account.</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={handleVerify} disabled={verifying || code.length !== 6} className="btn-primary w-full">
        {verifying ? "Verifying…" : "Verify & Sign In"}
      </button>
      <button type="button" onClick={() => setStage("phone")} className="w-full text-center text-xs text-slate-400 hover:underline">
        ← Use a different number
      </button>
    </div>
  );
}
