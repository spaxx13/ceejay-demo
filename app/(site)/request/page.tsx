import { store } from "@/lib/store";
import HomeServiceForm from "@/components/HomeServiceForm";

export default function RequestPage() {
  const brands = store.lookups
    .filter((l) => l.kind === "device_brand" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const models = store.deviceModels
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, brandId: m.brandId, name: m.name }));
  const serviceTypes = store.lookups
    .filter((l) => l.kind === "service_type" && l.active)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ id: l.id, label: l.label }));
  const content = store.requestFormContent;
  const fields = store.customFormFields.filter((f) => f.active).sort((a, b) => a.order - b.order);

  return (
    <main className="grid-bg px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <p className="kicker">{content.pageKicker}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{content.pageTitle}</h1>
          <p className="mt-2 text-sm text-slate-400">{content.pageSubtitle}</p>
        </div>
        {fields.length === 0 ? (
          <p className="card text-center text-sm text-slate-400">
            This form has no active fields right now — add or re-enable some from Admin &gt; Settings &gt; Request Form.
          </p>
        ) : (
          <HomeServiceForm brands={brands} models={models} serviceTypes={serviceTypes} content={content} fields={fields} />
        )}
      </div>
    </main>
  );
}
