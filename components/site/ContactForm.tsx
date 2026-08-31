"use client";

import { useActionState } from "react";
import { submitContactInquiry } from "@/lib/actions";

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactInquiry, undefined);

  if (state?.ok) {
    return (
      <div className="card space-y-2 text-center">
        <p className="text-3xl">✅</p>
        <h3 className="text-lg font-semibold text-slate-800">Message sent!</h3>
        <p className="text-sm text-slate-400">We&apos;ll get back to you as soon as we can.</p>
      </div>
    );
  }

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
          <label className="text-xs font-medium text-slate-500">Mobile Number</label>
          <input name="phone" className="input" placeholder="0917 123 4567" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Email</label>
          <input name="email" type="email" className="input" placeholder="juan@email.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">
          Message <span className="text-red-600">*</span>
        </label>
        <textarea name="message" required rows={4} className="input" placeholder="How can we help?" />
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
