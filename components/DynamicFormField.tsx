import type { CustomFormField } from "@/lib/types";

export default function DynamicFormField({ field }: { field: CustomFormField }) {
  const name = `custom_${field.key}`;

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name={name} value="on" className="h-4 w-4 rounded border-slate-300" />
        {field.label}
        {field.required && <span className="text-red-600">*</span>}
      </label>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">
        {field.label} {field.required && <span className="text-red-600">*</span>}
      </label>
      {field.type === "select" ? (
        <select name={name} required={field.required} className="input">
          <option value="">Select...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea name={name} required={field.required} rows={3} className="input" placeholder={field.placeholder} />
      ) : field.type === "date" ? (
        <input type="date" name={name} required={field.required} className="input" />
      ) : field.type === "datetime" ? (
        <input type="datetime-local" name={name} required={field.required} className="input" />
      ) : (
        <input type="text" name={name} required={field.required} className="input" placeholder={field.placeholder} />
      )}
    </div>
  );
}
