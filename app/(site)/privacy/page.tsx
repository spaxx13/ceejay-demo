export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="kicker">Legal</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-slate-400">Last updated September 25, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-600">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Information We Collect</h2>
          <p className="mt-2">
            When you book a repair, sign in to the Ceejay app, or contact us, we collect information such as your
            name, phone number, address, email, and details about your device. If you book Home Service or Pick-up
            &amp; Delivery, we also collect your service address and, while a technician or rider is en route, live
            location data so you can track them on the map.
          </p>
          <p className="mt-2">
            If you install the Ceejay app and enable notifications, we store a device push token so we can notify
            you about your booking (for example, when your technician or rider is on the way).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">How We Use Your Information</h2>
          <p className="mt-2">
            We use this information to schedule and fulfill your repair, communicate with you about your booking,
            process payments, and improve our service. We do not sell your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Third-Party Services</h2>
          <p className="mt-2">We work with the following service providers to operate Ceejay:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>PayMongo</strong> — processes online payments (GCash, cards). We do not store your full
              payment details ourselves.
            </li>
            <li>
              <strong>Semaphore</strong> — sends SMS messages, including one-time verification codes.
            </li>
            <li>
              <strong>Firebase (Google)</strong> — delivers push notifications to the Ceejay app.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Data Retention</h2>
          <p className="mt-2">
            We keep booking and repair records for as long as needed to provide our service and meet our business
            and legal obligations. You can ask us to delete your account and associated data at any time by
            contacting us below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Your Choices</h2>
          <p className="mt-2">
            You can decline notification permissions in your device settings at any time — this only stops push
            notifications and does not affect your ability to book or track a repair. You can also ask us to
            correct or delete your information by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Contact Us</h2>
          <p className="mt-2">
            Questions about this policy or your data? Reach us through the{" "}
            <a href="/contact" className="text-blue-600 hover:underline">
              Contact page
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
