"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { pollStaffChatMessages, postStaffChatMessage } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import type { Role, StaffChatMessage, StaffChatRoom } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  owner_admin: "Owner Admin",
  branch_admin: "Branch Admin",
  technician: "Technician",
  rider: "Rider",
};

const POLL_MS = 4000;

// Merges newly fetched messages onto the existing list, skipping any id
// already present — the interval poll and the right-after-send poll can
// land close enough together to both fetch the same just-posted message,
// so a plain append would show it twice.
function mergeMessages(prev: StaffChatMessage[], fresh: StaffChatMessage[]): StaffChatMessage[] {
  if (fresh.length === 0) return prev;
  const existingIds = new Set(prev.map((m) => m.id));
  const toAdd = fresh.filter((m) => !existingIds.has(m.id));
  return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
}

// One staff group chat room — "all" (/staff-chat, every staff role) or
// "admin" (/admin/admin-chat, owner admin + branch admin only; access is
// enforced server-side in postStaffChatMessage/pollStaffChatMessages, this
// prop just picks which room's messages to show). Polls for new messages
// on an interval rather than a websocket/Realtime subscription, same
// approach as live technician tracking elsewhere in this app (see
// TechnicianTrackingView).
export default function StaffChatView({
  initial,
  currentUserId,
  room,
}: {
  initial: StaffChatMessage[];
  currentUserId: string;
  room: StaffChatRoom;
}) {
  const [messages, setMessages] = useState(initial);
  // Read inside the polling interval/effect without re-creating it on every
  // new message — a plain `messages` dependency would restart the timer
  // (and re-fire the post-success effect) on each incoming message.
  const messagesRef = useRef(messages);
  const [state, formAction, pending] = useActionState(postStaffChatMessage, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // `pending` only flips after React commits the next render — too slow to
  // block a second Enter keydown some mobile keyboards fire in the same
  // burst as the first (IME composition quirk), which would otherwise post
  // the same message twice as two genuinely separate rows. A ref updates
  // synchronously, so it blocks the second call before that render happens.
  const submittingRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const lastId = messagesRef.current[messagesRef.current.length - 1]?.id ?? null;
      try {
        const fresh = await pollStaffChatMessages(lastId, room);
        if (fresh.length > 0) setMessages((prev) => (lastId ? mergeMessages(prev, fresh) : fresh));
      } catch {
        // offline for a moment — try again next tick
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [room]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!pending) submittingRef.current = false;
  }, [pending]);

  // The action doesn't hand back the row it just inserted — pick it up
  // (and anything posted elsewhere in the meantime) from an immediate poll
  // right after a successful send, instead of waiting for the next tick.
  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    const lastId = messagesRef.current[messagesRef.current.length - 1]?.id ?? null;
    pollStaffChatMessages(lastId, room).then((fresh) => {
      if (fresh.length > 0) setMessages((prev) => (lastId ? mergeMessages(prev, fresh) : fresh));
    });
  }, [state, room]);

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto pb-3">
        {messages.length === 0 && <p className="pt-8 text-center text-sm text-slate-400">No messages yet — say hi!</p>}
        {messages.map((m) => {
          const mine = m.userId === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {!mine && (
                  <p className="mb-0.5 text-xs font-semibold text-slate-500">
                    {m.userName} <span className="font-normal text-slate-400">· {ROLE_LABELS[m.role]}</span>
                  </p>
                )}
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{formatDateTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(e) => {
          if (submittingRef.current) {
            e.preventDefault();
            return;
          }
          submittingRef.current = true;
        }}
        className="flex items-end gap-2 border-t border-slate-200 pt-3"
      >
        <input type="hidden" name="room" value={room} />
        <textarea
          name="body"
          required
          rows={1}
          placeholder="Type a message..."
          className="input flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (submittingRef.current) return;
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={pending} className="btn-primary !px-4 !py-2 text-sm">
          Send
        </button>
      </form>
      {state && !state.ok && <p className="pt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
