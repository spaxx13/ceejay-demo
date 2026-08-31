import Link from "next/link";
import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import { updateSiteContent } from "@/lib/actions";

export default async function SiteContentPage() {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const sc = store.siteContent;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Landing Page</h1>
          <p className="mt-1 text-sm text-slate-400">Edit the copy shown on the public homepage hero and bottom CTA sections.</p>
        </div>
        <Link href="/" target="_blank" className="btn-secondary">
          View Live Page ↗
        </Link>
      </div>
      <SettingsTabs />

      <form action={updateSiteContent} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Hero</h3>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Kicker (small label above headline)</label>
            <input name="heroKicker" defaultValue={sc.heroKicker} className="input" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Headline — before highlight</label>
              <input name="heroHeadlinePrefix" defaultValue={sc.heroHeadlinePrefix} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Headline — highlighted phrase</label>
              <input name="heroHeadlineHighlight" defaultValue={sc.heroHeadlineHighlight} className="input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Headline — after highlight</label>
              <input name="heroHeadlineSuffix" defaultValue={sc.heroHeadlineSuffix} className="input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Subtext</label>
            <textarea name="heroSubtext" defaultValue={sc.heroSubtext} rows={2} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Button label</label>
            <input name="secondaryCtaLabel" defaultValue={sc.secondaryCtaLabel} className="input max-w-xs" />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Bottom CTA Banner</h3>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Title</label>
            <input name="ctaBannerTitle" defaultValue={sc.ctaBannerTitle} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Subtitle</label>
            <input name="ctaBannerSubtitle" defaultValue={sc.ctaBannerSubtitle} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Button label</label>
            <input name="ctaBannerButtonLabel" defaultValue={sc.ctaBannerButtonLabel} className="input max-w-xs" />
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>
    </div>
  );
}
