import IcloudCheckForm from "@/components/IcloudCheckForm";
import { ICLOUD_CHECK_PRICE_PESOS } from "@/lib/config";

export default function CheckIcloudPage() {
  return (
    <main>
      <section className="grid-bg px-4 py-14 text-center sm:px-6">
        <p className="kicker">iCloud Status Check</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Check if Find My iPhone is ON or OFF</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 sm:text-base">
          Buying a used iPhone? Confirm whether iCloud/Find My Device is still enabled before you pay — a quick ₱{ICLOUD_CHECK_PRICE_PESOS}{" "}
          check on the IMEI or serial number.
        </p>
      </section>

      <section className="mx-auto max-w-lg px-4 pb-16 sm:px-6">
        <IcloudCheckForm pricePesos={ICLOUD_CHECK_PRICE_PESOS} />

        <div className="card mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">How it works</h3>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-500">
            <li>Enter the IMEI or serial number and pay ₱{ICLOUD_CHECK_PRICE_PESOS} via GCash or card.</li>
            <li>Your result shows automatically once payment is confirmed — usually within seconds.</li>
            <li>This only tells you whether Find My Device is ON or OFF — it does not unlock or remove iCloud activation lock.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
