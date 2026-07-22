import { useEffect, useState } from "react";
import { KeyRoundIcon } from "lucide-react";
import { Button } from "@easytable/ui/components/button";
import { Input } from "@easytable/ui/components/input";

import { loadLocalPosUsers, loginLocalPos } from "../lib/local-master-client";
import type { LocalPosSession, LocalPosUser } from "../lib/pos-types";

export function LocalPosLogin({ onAuthenticated }: { onAuthenticated: (session: LocalPosSession) => void }) {
  const [users, setUsers] = useState<LocalPosUser[]>([]);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadLocalPosUsers()
      .then((loaded) => {
        setUsers(loaded);
        setUserId(loaded[0]?.user_id ?? "");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  async function submit() {
    if (!userId || !pin || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      onAuthenticated(await loginLocalPos(userId, pin));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex h-svh items-center justify-center bg-[#f6f7fb] p-6 text-slate-950">
      <section className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-lg shadow-slate-200/70">
        <div className="mb-6 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-slate-950 text-white"><KeyRoundIcon className="size-5" /></span><div><h1 className="text-xl font-semibold">Kasse entsperren</h1><p className="text-sm text-muted-foreground">Bedienperson auswählen und PIN eingeben</p></div></div>
        <div className="space-y-4">
          <label className="block text-sm font-medium">Bedienperson<select className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={userId} onChange={(event) => setUserId(event.target.value)}>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.display_name} · {user.role}</option>)}</select></label>
          <label className="block text-sm font-medium">PIN<Input className="mt-1 h-11" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} /></label>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          <Button className="h-12 w-full" disabled={!userId || !pin || isSubmitting} onClick={() => void submit()}>{isSubmitting ? "Entsperren..." : "Entsperren"}</Button>
        </div>
      </section>
    </main>
  );
}
