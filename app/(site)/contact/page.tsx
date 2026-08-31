import { getBranches } from "@/lib/db";
import ContactForm from "@/components/site/ContactForm";

export default async function ContactPage() {
  const branches = (await getBranches()).filter((b) => b.active);

  return (
    <main className="grid-bg px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="kicker">Get In Touch</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Contact Us</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Questions about a repair, pricing, or which branch to visit? Send us a message or call a branch directly.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ContactForm />

          <div className="space-y-4">
            {branches.map((b) => (
              <div key={b.id} className="card">
                <p className="font-semibold text-slate-800">{b.name}</p>
                <p className="mt-1 text-sm text-slate-400">{b.address}</p>
                <p className="mt-2 text-sm text-blue-300">{b.contactNumber}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
