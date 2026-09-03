"use client";

export default function PrintReceiptButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary print:hidden">
      Print Receipt
    </button>
  );
}
