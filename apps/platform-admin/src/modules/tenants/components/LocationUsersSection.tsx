import { useEffect, useState, type FormEvent } from "react";
import { Pencil, RefreshCw, UserPlus } from "lucide-react";

import { Badge } from "@easytable/ui/components/badge";
import { Button } from "@easytable/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@easytable/ui/components/dialog";
import { Input } from "@easytable/ui/components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@easytable/ui/components/table";

import type { Location, Tenant, TenantLocationUser, TenantLocationUserInput, TenantUserRole } from "../../../lib/relay-sync-api";

type LocationUsersSectionProps = {
  tenant: Tenant | null;
  location: Location | null;
  users: TenantLocationUser[];
  isLoading: boolean;
  onReload: () => void;
  onCreate: (input: TenantLocationUserInput) => Promise<void>;
  onUpdate: (userId: string, input: Partial<TenantLocationUserInput>) => Promise<void>;
};

const roles: TenantUserRole[] = ["OWNER", "MANAGER", "STAFF", "KDS", "POS_OPERATOR"];

export function LocationUsersSection({ tenant, location, users, isLoading, onReload, onCreate, onUpdate }: LocationUsersSectionProps) {
  const canManage = Boolean(tenant && location);

  return (
    <section className="rounded-md border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">User</h2>
          <p className="text-sm text-muted-foreground">
            {location ? `Benutzer fuer ${location.name}` : "Erst eine Location auswaehlen."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canManage || isLoading} onClick={onReload} type="button" variant="outline">
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
            Laden
          </Button>
          <UserDialog disabled={!canManage} mode="create" onSubmit={onCreate} />
        </div>
      </div>

      <div className="p-2 sm:p-3">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{user.display_name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={user.has_password ? "secondary" : "outline"}>{user.has_password ? "Passwort" : "Kein Passwort"}</Badge>
                      <Badge variant={user.has_pin ? "secondary" : "outline"}>{user.has_pin ? "PIN" : "Kein PIN"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" && user.is_active ? "secondary" : "outline"}>
                      {user.is_active ? user.status : "INACTIVE"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <UserDialog mode="edit" onSubmit={(input) => onUpdate(user.user_id, input)} user={user} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={5}>
                    {location ? "Keine User vorbereitet." : "Keine Location ausgewaehlt."}
                  </TableCell>
                </TableRow>
              ) : null}

              {isLoading ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={5}>
                    User werden geladen.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

function UserDialog({
  disabled = false,
  mode,
  onSubmit,
  user,
}: {
  disabled?: boolean;
  mode: "create" | "edit";
  onSubmit: (input: TenantLocationUserInput) => Promise<void>;
  user?: TenantLocationUser;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => createUserForm(user));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === "edit";

  useEffect(() => {
    if (open) {
      setForm(createUserForm(user));
      setError(null);
    }
  }, [open, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await onSubmit({
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        role: form.role,
        password: form.password.trim() || undefined,
        pin: form.pin.trim() || undefined,
        status: form.status,
        is_active: form.is_active,
      });
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "User konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button disabled={disabled} onClick={() => setOpen(true)} size={isEdit ? "icon-sm" : "default"} type="button" variant={isEdit ? "ghost" : "default"}>
        {isEdit ? <Pencil className="size-4" /> : <UserPlus className="size-4" />}
        {!isEdit ? "User" : <span className="sr-only">Bearbeiten</span>}
      </Button>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "User bearbeiten" : "User vorbereiten"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Name</span>
              <Input onChange={(event) => setForm({ ...form, display_name: event.target.value })} required value={form.display_name} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">E-Mail</span>
              <Input onChange={(event) => setForm({ ...form, email: event.target.value })} required type="email" value={form.email} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Rolle</span>
              <select className="h-9 rounded-md border border-input bg-background px-2.5 text-sm" onChange={(event) => setForm({ ...form, role: event.target.value as TenantUserRole })} value={form.role}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Status</span>
              <select className="h-9 rounded-md border border-input bg-background px-2.5 text-sm" onChange={(event) => setForm({ ...form, status: event.target.value as TenantLocationUserInput["status"] })} value={form.status}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INVITED">INVITED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{isEdit ? "Neues Passwort" : "Initiales Passwort"}</span>
              <Input minLength={isEdit ? undefined : 8} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!isEdit} type="password" value={form.password} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">POS PIN</span>
              <Input inputMode="numeric" onChange={(event) => setForm({ ...form, pin: event.target.value })} pattern="[0-9]{4,8}" value={form.pin} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />
            Fuer diese Location aktiv
          </label>

          {error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button disabled={isSaving} type="submit">{isSaving ? "Speichert..." : "Speichern"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function createUserForm(user?: TenantLocationUser) {
  return {
    email: user?.email ?? "",
    display_name: user?.display_name ?? "",
    role: user?.role ?? "STAFF",
    password: "",
    pin: "",
    status: user?.status ?? "ACTIVE",
    is_active: user?.is_active ?? true,
  };
}
