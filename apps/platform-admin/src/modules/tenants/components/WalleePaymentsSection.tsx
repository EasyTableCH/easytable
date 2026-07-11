import { Eye, EyeOff, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@easytable/ui/components/badge";
import { Button } from "@easytable/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@easytable/ui/components/table";

import type {
  Location,
  Tenant,
  WalleePaymentProfile,
  WalleePaymentProfileInput,
  WalleePaymentTerminal,
  WalleePaymentTerminalInput
} from "../../../lib/relay-sync-api";

type WalleePaymentsSectionProps = {
  tenant: Tenant | null;
  location: Location | null;
  profile: WalleePaymentProfile | null;
  terminals: WalleePaymentTerminal[];
  isLoading: boolean;
  onReload: () => void;
  onRepublish: () => Promise<void>;
  onSaveProfile: (input: WalleePaymentProfileInput) => Promise<void>;
  onCreateTerminal: (input: WalleePaymentTerminalInput) => Promise<void>;
  onUpdateTerminal: (terminalId: string, input: Partial<WalleePaymentTerminalInput>) => Promise<void>;
  onDeleteTerminal: (terminalId: string) => Promise<void>;
};

export function WalleePaymentsSection({
  tenant,
  location,
  profile,
  terminals,
  isLoading,
  onReload,
  onRepublish,
  onSaveProfile,
  onCreateTerminal,
  onUpdateTerminal,
  onDeleteTerminal
}: WalleePaymentsSectionProps) {
  const canManage = Boolean(tenant && location);
  const [form, setForm] = useState(() => createProfileForm(profile));
  const [terminalForm, setTerminalForm] = useState(createTerminalForm());
  const [isSaving, setIsSaving] = useState(false);
  const [showApplicationSecret, setShowApplicationSecret] = useState(false);
  const [showWebhookKey, setShowWebhookKey] = useState(false);

  useEffect(() => {
    setForm(createProfileForm(profile));
  }, [profile?.id, profile?.updated_at]);

  async function submitProfile() {
    setIsSaving(true);
    try {
      await onSaveProfile({
        space_id: form.space_id,
        application_user_id: form.application_user_id,
        application_user_secret: form.application_user_secret || null,
        webhook_signature_key: form.webhook_signature_key || null,
        enabled: form.enabled
      });
      setForm((current) => ({ ...current, application_user_secret: "", webhook_signature_key: "" }));
      toast.success("Wallee Konfiguration gespeichert.");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Wallee Konfiguration konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitTerminal() {
    setIsSaving(true);
    try {
      await onCreateTerminal(terminalForm);
      setTerminalForm(createTerminalForm());
      toast.success("Wallee Terminal gespeichert.");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Wallee Terminal konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTerminal(terminal: WalleePaymentTerminal) {
    if (!window.confirm("Wallee Terminal " + terminal.display_name + " wirklich loeschen?")) {
      return;
    }

    setIsSaving(true);
    try {
      await onDeleteTerminal(terminal.id);
      toast.success("Wallee Terminal geloescht.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Wallee Terminal konnte nicht geloescht werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-md border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Wallee Payments</h2>
          <p className="text-sm text-muted-foreground">
            {location ? `Terminal-Konfiguration fuer ${location.name}` : "Erst eine Location auswaehlen."}
          </p>
        </div>
        <Button disabled={!canManage || isLoading} onClick={onReload} type="button" variant="outline">
          <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
          Laden
        </Button>
        <Button disabled={!canManage || !profile || isSaving} onClick={() => void onRepublish()} type="button" variant="outline">
          <RefreshCw className="size-4" />
          Konfiguration zustellen
        </Button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Profil</h3>
            <Badge variant={profile?.enabled ? "secondary" : "outline"}>{profile?.enabled ? "Aktiv" : "Inaktiv"}</Badge>
            {profile ? <Badge variant="outline">Version {profile.config_version}</Badge> : null}
          </div>
          {profile ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={profile.config_delivery.status === "failed" ? "destructive" : profile.config_delivery.status === "accepted" ? "secondary" : "outline"}>
                Zustellung: {deliveryLabel(profile.config_delivery.status)}
              </Badge>
              <span>LocalMaster-Version: {profile.config_delivery.active_local_master_version ?? "–"}</span>
              {profile.config_delivery.error ? <span className="text-destructive">{profile.config_delivery.error}</span> : null}
            </div>
          ) : null}
          <label className="grid gap-1 text-sm">
            Space ID
            <input className="h-9 rounded-md border bg-background px-2.5" disabled={!canManage} value={form.space_id} onChange={(event) => setForm({ ...form, space_id: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            Application User ID
            <input className="h-9 rounded-md border bg-background px-2.5" disabled={!canManage} value={form.application_user_id} onChange={(event) => setForm({ ...form, application_user_id: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            Neues Application Secret
            <span className="flex h-9 overflow-hidden rounded-md border bg-background">
              <input className="min-w-0 flex-1 bg-transparent px-2.5 outline-none" disabled={!canManage} type={showApplicationSecret ? "text" : "password"} value={form.application_user_secret} onChange={(event) => setForm({ ...form, application_user_secret: event.target.value })} />
              <button
                className="flex w-9 items-center justify-center border-l text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                disabled={!canManage}
                onClick={() => setShowApplicationSecret((current) => !current)}
                title={showApplicationSecret ? "Secret verbergen" : "Secret anzeigen"}
                type="button"
              >
                {showApplicationSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          <label className="grid gap-1 text-sm">
            Neuer Webhook Public Key
            <span className="flex h-9 overflow-hidden rounded-md border bg-background">
              <input className="min-w-0 flex-1 bg-transparent px-2.5 outline-none" disabled={!canManage} type={showWebhookKey ? "text" : "password"} value={form.webhook_signature_key} onChange={(event) => setForm({ ...form, webhook_signature_key: event.target.value })} />
              <button
                className="flex w-9 items-center justify-center border-l text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                disabled={!canManage}
                onClick={() => setShowWebhookKey((current) => !current)}
                title={showWebhookKey ? "Public Key verbergen" : "Public Key anzeigen"}
                type="button"
              >
                {showWebhookKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input checked={form.enabled} disabled={!canManage} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} type="checkbox" />
            Aktiv
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!canManage || isSaving} onClick={() => void submitProfile()} type="button">
              <Save className="size-4" />
              Speichern
            </Button>
            {profile?.has_application_user_secret ? <Badge variant="outline">Secret gespeichert</Badge> : null}
            {profile?.has_webhook_signature_key ? <Badge variant="outline">Webhook Key gespeichert</Badge> : null}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <h3 className="text-sm font-semibold">Terminal hinzufuegen</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="h-9 rounded-md border bg-background px-2.5 text-sm" disabled={!canManage || !profile} placeholder="Name" value={terminalForm.display_name} onChange={(event) => setTerminalForm({ ...terminalForm, display_name: event.target.value })} />
            <input className="h-9 rounded-md border bg-background px-2.5 text-sm" disabled={!canManage || !profile} placeholder="Terminal ID (interne wallee ID)" value={terminalForm.terminal_id ?? ""} onChange={(event) => setTerminalForm({ ...terminalForm, terminal_id: event.target.value })} />
            <input className="h-9 rounded-md border bg-background px-2.5 text-sm" disabled={!canManage || !profile} placeholder="Terminal Identifier" value={terminalForm.terminal_identifier ?? ""} onChange={(event) => setTerminalForm({ ...terminalForm, terminal_identifier: event.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input checked={terminalForm.is_default} disabled={!canManage || !profile} onChange={(event) => setTerminalForm({ ...terminalForm, is_default: event.target.checked })} type="checkbox" />
              Standard
            </label>
          </div>
          <Button className="w-fit" disabled={!canManage || !profile || isSaving} onClick={() => void submitTerminal()} type="button" variant="outline">
            <Plus className="size-4" />
            Terminal
          </Button>
        </div>
      </div>

      <div className="p-2 sm:p-3">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Wallee Referenz</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminals.map((terminal) => (
                <TableRow key={terminal.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{terminal.display_name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{terminal.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1 text-sm">
                      <span>{terminal.terminal_id ?? "Keine Terminal ID"}</span>
                      <span className="text-muted-foreground">{terminal.terminal_identifier ?? "Kein Identifier"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {terminal.is_default ? <Badge variant="secondary">Standard</Badge> : null}
                      <Badge variant={terminal.is_active ? "outline" : "destructive"}>{terminal.is_active ? "Aktiv" : "Inaktiv"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button disabled={terminal.is_default} onClick={() => void onUpdateTerminal(terminal.id, { is_default: true })} size="sm" type="button" variant="ghost">
                        Standard
                      </Button>
                      <Button onClick={() => void onUpdateTerminal(terminal.id, { is_active: !terminal.is_active })} size="sm" type="button" variant="ghost">
                        {terminal.is_active ? "Deaktivieren" : "Aktivieren"}
                      </Button>
                      <Button onClick={() => void deleteTerminal(terminal)} size="sm" type="button" variant="ghost">
                        <Trash2 className="size-4" />
                        Loeschen
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && terminals.length === 0 ? (
                <TableRow>
                  <TableCell className="h-20 text-center text-muted-foreground" colSpan={4}>
                    {profile ? "Keine wallee Terminals konfiguriert." : "Erst ein wallee Profil speichern."}
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

function createProfileForm(profile: WalleePaymentProfile | null) {
  return {
    space_id: profile?.space_id ?? "",
    application_user_id: profile?.application_user_id ?? "",
    application_user_secret: "",
    webhook_signature_key: "",
    enabled: profile?.enabled ?? true
  };
}

function createTerminalForm(): WalleePaymentTerminalInput {
  return {
    display_name: "",
    terminal_id: "",
    terminal_identifier: "",
    is_default: false,
    is_active: true
  };
}

function deliveryLabel(status: WalleePaymentProfile["config_delivery"]["status"]) {
  if (status === "pending") return "Ausstehend";
  if (status === "delivered") return "Zugestellt";
  if (status === "accepted") return "Akzeptiert";
  if (status === "failed") return "Fehlgeschlagen";
  return "Nicht veröffentlicht";
}
