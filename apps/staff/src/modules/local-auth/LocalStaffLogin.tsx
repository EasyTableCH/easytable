import { useEffect, useState, type ReactNode } from "react";

type DeviceConfig = { terminalId: string; terminalSecret: string };
type LoginUser = { user_id: string; display_name: string; role: string };
export type LocalStaffSession = { token: string; user_id: string; email: string; display_name: string; role: string; expires_at: number };

const deviceKey = "easytable.staff.local-device";
const sessionKey = "easytable.staff.local-session";

export function getStoredLocalSessionToken() { return window.localStorage.getItem(sessionKey); }

export async function loadStoredLocalSession() {
  const token = getStoredLocalSessionToken();
  if (!token) return null;
  const response = await fetch("/api/local-auth/session", { headers: { Authorization: "Bearer " + token } });
  if (!response.ok) { window.localStorage.removeItem(sessionKey); return null; }
  return response.json() as Promise<LocalStaffSession>;
}
export function clearStoredLocalSession() { window.localStorage.removeItem(sessionKey); }

export function LocalStaffLogin({ onAuthenticated }: { onAuthenticated: (session: LocalStaffSession) => void }) {
  const [device, setDevice] = useState<DeviceConfig | null>(() => readDevice());
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("Staff Gerät");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!device) return;
    void fetch("/api/local-auth/users", { headers: deviceHeaders(device) })
      .then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json() as Promise<LoginUser[]>; })
      .then((rows) => { setUsers(rows); setUserId((current) => current || rows[0]?.user_id || ""); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [device]);

  if (!device) {
    return <AuthCard title="Dieses Staff-Gerät autorisieren" error={error}>
      <input className="h-11 rounded-md border px-3" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Gerätename" />
      <input className="h-11 rounded-md border px-3" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Pairing-Code" />
      <button className="h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground" type="button" onClick={() => void pairDevice(code, deviceName).then((next) => { writeDevice(next); setDevice(next); }).catch((reason) => setError(String(reason)))}>Gerät koppeln</button>
    </AuthCard>;
  }

  return <AuthCard title="Staff lokal entsperren" error={error}>
    <select className="h-11 rounded-md border px-3" value={userId} onChange={(event) => setUserId(event.target.value)}>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.display_name} · {user.role}</option>)}</select>
    <input className="h-11 rounded-md border px-3" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" />
    <button className="h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground" type="button" onClick={() => void login(device, userId, pin).then((session) => { window.localStorage.setItem(sessionKey, session.token); onAuthenticated(session); }).catch((reason) => setError(String(reason)))}>Entsperren</button>
  </AuthCard>;
}

function AuthCard({ title, error, children }: { title: string; error: string | null; children: ReactNode }) { return <main className="grid min-h-screen place-items-center bg-background p-6"><section className="grid w-full max-w-md gap-4 rounded-md border bg-card p-6"><h1 className="text-xl font-semibold">{title}</h1>{error ? <p className="text-sm text-destructive">{error}</p> : null}{children}</section></main>; }
function readDevice() { try { return JSON.parse(window.localStorage.getItem(deviceKey) || "null") as DeviceConfig | null; } catch { return null; } }
function writeDevice(device: DeviceConfig) { window.localStorage.setItem(deviceKey, JSON.stringify(device)); }
function deviceHeaders(device: DeviceConfig) { return { "X-EasyTable-Device-Id": device.terminalId, "X-EasyTable-Device-Secret": device.terminalSecret }; }
async function pairDevice(code: string, deviceName: string) { const response = await fetch("/api/local-auth/devices/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: { code, device_name: deviceName, local_master_url: window.location.origin } }) }); if (!response.ok) throw new Error(await response.text()); return response.json() as Promise<DeviceConfig>; }
async function login(device: DeviceConfig, userId: string, pin: string) { const response = await fetch("/api/local-auth/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: { device_id: device.terminalId, device_secret: device.terminalSecret, user_id: userId, pin } }) }); if (!response.ok) throw new Error(await response.text()); return response.json() as Promise<LocalStaffSession>; }
