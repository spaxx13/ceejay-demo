import { checkIn } from "@/lib/actions";
import { formatTime } from "@/lib/format";

type Branch = { id: string; name: string };

export default function CheckInWidget({
  branches,
  todayCheckIn,
}: {
  branches: Branch[];
  todayCheckIn: { branchName: string; checkedInAt: string } | null;
}) {
  if (todayCheckIn) {
    return (
      <div className="card flex items-center gap-2 border-green-200 bg-green-50">
        <span className="text-xl">✅</span>
        <p className="text-sm text-green-800">
          Checked in today at <span className="font-semibold">{formatTime(todayCheckIn.checkedInAt)}</span> — {todayCheckIn.branchName}
        </p>
      </div>
    );
  }

  if (branches.length === 0) {
    return <div className="card text-sm text-slate-400">No branch assigned to check in at — contact the owner to get one added to your account.</div>;
  }

  return (
    <form action={checkIn} className="card flex flex-wrap items-center gap-3">
      <p className="text-sm font-semibold text-slate-800">Check in for today</p>
      {branches.length === 1 ? (
        <input type="hidden" name="branchId" value={branches[0].id} />
      ) : (
        <select name="branchId" required defaultValue="" className="input w-auto flex-1 sm:flex-none">
          <option value="" disabled>
            Select branch...
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="btn-primary !px-4 !py-1.5 text-sm">
        {branches.length === 1 ? `Check In at ${branches[0].name}` : "Check In"}
      </button>
    </form>
  );
}
