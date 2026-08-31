import Link from "next/link";
import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import FieldManager from "@/components/FieldManager";
import { updateRequestFormContent } from "@/lib/actions";

export default async function RequestFormContentPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const rc = store.requestFormContent;
  const fields = [...store.customFormFields].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Request Form</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every field on the public Home Service Request form — built-in and custom — lives in one editable, reorderable list below.
          </p>
        </div>
        <Link href="/request" target="_blank" className="btn-secondary">
          View Live Form ↗
        </Link>
      </div>
      <SettingsTabs />

      <form action={updateRequestFormContent} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Page Header</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Kicker</label>
              <input name="pageKicker" defaultValue={rc.pageKicker} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Title</label>
              <input name="pageTitle" defaultValue={rc.pageTitle} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Subtitle</label>
              <input name="pageSubtitle" defaultValue={rc.pageSubtitle} className="input" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Submit &amp; Confirmation</h3>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Submit button label</label>
            <input name="submitButtonLabel" defaultValue={rc.submitButtonLabel} className="input max-w-xs" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Confirmation title</label>
              <input name="successTitle" defaultValue={rc.successTitle} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Confirmation message</label>
              <input name="successBody" defaultValue={rc.successBody} className="input" />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Fields</h3>
          <p className="text-xs text-slate-400">
            Reorder with the arrows, switch a field off to remove it from the form (built-in fields included — Name, Phone, Address, Photo,
            anything), toggle Required, or add a brand-new question (text, long text, dropdown, checkbox, or date).
          </p>
        </div>
        <FieldManager fields={fields} />
      </div>
    </div>
  );
}
