import { addConversationMessage } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import type { ConversationMessage } from "@/lib/types";

const CHANNEL_LABELS: Record<ConversationMessage["channel"], string> = {
  note: "Note",
  call: "Call",
  sms: "SMS",
  email: "Email",
  chat: "Chat",
};

export default function ConversationThread({
  entityType,
  entityId,
  messages,
}: {
  entityType: "lead" | "customer";
  entityId: string;
  messages: ConversationMessage[];
}) {
  return (
    <div className="card space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Conversation</h3>
        <p className="text-xs text-slate-400">
          Log every call, text, email, or quick note with this {entityType} — the whole team sees the same back-and-forth here.
        </p>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No messages yet — log the first one below.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-800"}`}>
              <p className="whitespace-pre-line">{m.message}</p>
              <p className={`mt-1 text-[11px] ${m.direction === "outbound" ? "text-blue-400" : "text-slate-400"}`}>
                {CHANNEL_LABELS[m.channel]} · {m.direction === "outbound" ? m.staffName || "Staff" : "Customer"} · {formatDateTime(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form action={addConversationMessage} className="space-y-2 border-t border-slate-200 pt-3">
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <textarea name="message" rows={2} required className="input" placeholder="Type what was said..." />
        <div className="flex flex-wrap items-center gap-2">
          <select name="direction" defaultValue="outbound" className="input w-auto">
            <option value="outbound">We said (to customer)</option>
            <option value="inbound">Customer said</option>
          </select>
          <select name="channel" defaultValue="note" className="input w-auto">
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="chat">Chat</option>
          </select>
          <button type="submit" className="btn-primary ml-auto">
            Log Message
          </button>
        </div>
      </form>
    </div>
  );
}
