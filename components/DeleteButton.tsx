"use client";

export default function DeleteButton({
  id,
  action,
  confirmMessage,
  label = "Delete",
  className = "btn-secondary !px-3 !py-1 text-xs !text-red-600",
}: {
  id: string;
  action: (formData: FormData) => void;
  confirmMessage: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={(fd) => {
        if (confirm(confirmMessage)) action(fd);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
