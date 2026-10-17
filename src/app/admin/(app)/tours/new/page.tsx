import { ActionForm } from "@/components/action-form";
import { createTourAction } from "../actions";

export const metadata = { title: "New tour · Fan Activations" };

export default function NewTourPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">New tour</h1>
      <div className="card max-w-3xl">
        <ActionForm action={createTourAction} submitLabel="Create tour">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="label">Artist</span><input name="artist_name" required className="input" placeholder="Oasis" /></label>
            <label className="block"><span className="label">Tour name</span><input name="name" required className="input" placeholder="Live '27 European Tour" /></label>
          </div>
          <label className="block">
            <span className="label">Dates (optional — you can add them one by one next)</span>
            <textarea name="dates" rows={8} className="input font-mono text-xs"
              placeholder={"2027-06-11 | Wembley Stadium | London | GB | 51.556 | -0.2796\n2027-06-12 | Wembley Stadium | London | GB"} />
            <span className="mt-1 block text-xs text-zinc-500">One per line: date | venue | city | country code | latitude | longitude (coordinates optional).</span>
          </label>
          <label className="block"><span className="label">Notes</span><textarea name="notes" rows={2} className="input" /></label>
        </ActionForm>
      </div>
    </>
  );
}
