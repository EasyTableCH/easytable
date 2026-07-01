import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, MapPin, Pencil, Plus, RefreshCw, WifiOff } from "lucide-react";

import { Badge } from "@easytable/ui/components/badge";
import { Button } from "@easytable/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@easytable/ui/components/dialog";
import { Input } from "@easytable/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@easytable/ui/components/table";

import { AppLayout } from "./layout/AppLayout";
import {
  createLocation,
  createTenant,
  getRelaySyncApiUrl,
  loadLocations,
  loadTenants,
  updateLocation,
  updateTenant,
  type Location,
  type LocationInput,
  type Tenant,
  type TenantInput,
} from "./lib/relay-sync-api";

function App() {
  return (
    <AppLayout>
      <TenantsPage />
    </AppLayout>
  );
}

function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tenants;
    }

    return tenants.filter((tenant) =>
      [tenant.id, tenant.name, tenant.slug, tenant.email ?? "", tenant.phone ?? "", tenant.website ?? "", tenant.status].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [search, tenants]);

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0] ?? null;

  async function refreshTenants() {
    setIsLoading(true);
    setError(null);

    try {
      const nextTenants = await loadTenants();
      setTenants(nextTenants);
      setSelectedTenantId((current) => current ?? nextTenants[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Tenants konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setError(null);

    try {
      await action();
      await refreshTenants();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Aktion fehlgeschlagen.");
      throw actionError;
    }
  }

  useEffect(() => {
    void refreshTenants();
  }, []);

  useEffect(() => {
    if (!selectedTenant) {
      setLocations([]);
      return;
    }

    void refreshLocations(selectedTenant.id);
  }, [selectedTenant?.id]);

  async function refreshLocations(tenantId = selectedTenant?.id) {
    if (!tenantId) {
      return;
    }

    setIsLoadingLocations(true);
    setError(null);

    try {
      setLocations(await loadLocations(tenantId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Locations konnten nicht geladen werden.");
    } finally {
      setIsLoadingLocations(false);
    }
  }

  async function runLocationAction(action: () => Promise<void>) {
    if (!selectedTenant) {
      return;
    }

    setError(null);

    try {
      await action();
      await refreshLocations(selectedTenant.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Location-Aktion fehlgeschlagen.");
      throw actionError;
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-md border bg-card p-4 text-card-foreground shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Platform / Administration</p>
          <h2 className="text-2xl font-semibold tracking-normal">Tenants</h2>
        </div>
        <span className="max-w-full truncate rounded-md border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          {getRelaySyncApiUrl()}
        </span>
      </section>

      {error ? <ErrorBanner message={error} onRetry={refreshTenants} /> : null}

      <section className="rounded-md border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">Tenants</h2>
            <p className="text-sm text-muted-foreground">Mandanten fuer lokale Standorte und spaeteren Sync verwalten.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isLoading} onClick={refreshTenants} type="button" variant="outline">
              <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
              Laden
            </Button>
            <TenantFormDialog mode="create" onSubmit={(input) => runAction(async () => void (await createTenant(input)))} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tenant, Slug, ID oder Status suchen"
              value={search}
            />
          </div>
        </div>

        <div className="p-2 sm:p-3">
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Erstellt</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow
                    className={tenant.id === selectedTenant?.id ? "bg-muted/50" : undefined}
                    key={tenant.id}
                    onClick={() => setSelectedTenantId(tenant.id)}
                  >
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="font-medium">{tenant.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{tenant.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{tenant.slug}</TableCell>
                    <TableCell>
                      <div className="grid gap-1 text-sm">
                        <span>{tenant.email ?? "Keine E-Mail"}</span>
                        <span className="text-muted-foreground">{tenant.phone ?? tenant.website ?? "Keine Kontaktdaten"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === "ACTIVE" ? "secondary" : "outline"}>{tenant.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatDate(tenant.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <TenantFormDialog
                          mode="edit"
                          onSubmit={(input) => runAction(async () => void (await updateTenant(tenant.id, input)))}
                          tenant={tenant}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!isLoading && filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                      Keine Tenants gefunden.
                    </TableCell>
                  </TableRow>
                ) : null}

                {isLoading ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                      Tenants werden geladen.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <LocationsSection
        isLoading={isLoadingLocations}
        locations={locations}
        onCreate={(input) => runLocationAction(async () => void (await createLocation(selectedTenant?.id ?? "", input)))}
        onReload={() => refreshLocations()}
        onUpdate={(locationId, input) => runLocationAction(async () => void (await updateLocation(selectedTenant?.id ?? "", locationId, input)))}
        tenant={selectedTenant}
      />
    </div>
  );
}

type TenantFormDialogProps = {
  tenant?: Tenant;
  mode: "create" | "edit";
  onSubmit: (input: TenantInput) => Promise<void>;
};

function TenantFormDialog({ tenant, mode, onSubmit }: TenantFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => createTenantFormState(tenant));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = mode === "edit";

  useEffect(() => {
    if (open) {
      setForm(createTenantFormState(tenant));
      setError(null);
    }
  }, [open, tenant]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await onSubmit({
        name: form.name.trim(),
        slug: form.slug.trim(),
        email: normalizeOptionalText(form.email),
        phone: normalizeOptionalText(form.phone),
        website: normalizeOptionalText(form.website),
        status: form.status,
      });
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Tenant konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)} size={isEdit ? "icon-sm" : "default"} title={isEdit ? "Bearbeiten" : "Tenant erstellen"} type="button" variant={isEdit ? "ghost" : "default"}>
        {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        {!isEdit ? "Tenant" : <span className="sr-only">Bearbeiten</span>}
      </Button>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Tenant bearbeiten" : "Tenant erstellen"}</DialogTitle>
            <DialogDescription>Tenants sind die Cloud-Klammer fuer Standorte, Benutzer und Sync-Daten.</DialogDescription>
          </DialogHeader>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <Input onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Slug</span>
            <Input onChange={(event) => setForm({ ...form, slug: event.target.value })} pattern="[a-z0-9-]+" required value={form.slug} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">E-Mail</span>
              <Input onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" value={form.email} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Telefon</span>
              <Input onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Website</span>
            <Input onChange={(event) => setForm({ ...form, website: event.target.value })} type="url" value={form.website} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Status</span>
            <select
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) => setForm({ ...form, status: event.target.value as TenantInput["status"] })}
              value={form.status}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </label>

          {error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type LocationsSectionProps = {
  tenant: Tenant | null;
  locations: Location[];
  isLoading: boolean;
  onReload: () => void;
  onCreate: (input: LocationInput) => Promise<void>;
  onUpdate: (locationId: string, input: LocationInput) => Promise<void>;
};

function LocationsSection({ tenant, locations, isLoading, onReload, onCreate, onUpdate }: LocationsSectionProps) {
  return (
    <section className="rounded-md border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Locations</h2>
          <p className="text-sm text-muted-foreground">
            {tenant ? `Standorte fuer ${tenant.name}` : "Erst einen Tenant auswaehlen."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!tenant || isLoading} onClick={onReload} type="button" variant="outline">
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
            Laden
          </Button>
          <LocationFormDialog disabled={!tenant} mode="create" onSubmit={onCreate} />
        </div>
      </div>

      <div className="p-2 sm:p-3">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>LocalMaster</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{location.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{location.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{location.slug}</TableCell>
                  <TableCell>{location.address ?? "Keine Adresse"}</TableCell>
                  <TableCell className="font-mono text-xs">{location.local_master_instance_id ?? "Nicht gekoppelt"}</TableCell>
                  <TableCell>
                    <Badge variant={location.status === "ACTIVE" ? "secondary" : "outline"}>{location.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <LocationFormDialog
                        location={location}
                        mode="edit"
                        onSubmit={(input) => onUpdate(location.id, input)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && locations.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                    Keine Locations gefunden.
                  </TableCell>
                </TableRow>
              ) : null}

              {isLoading ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                    Locations werden geladen.
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

type LocationFormDialogProps = {
  location?: Location;
  mode: "create" | "edit";
  disabled?: boolean;
  onSubmit: (input: LocationInput) => Promise<void>;
};

function LocationFormDialog({ location, mode, disabled = false, onSubmit }: LocationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => createLocationFormState(location));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = mode === "edit";

  useEffect(() => {
    if (open) {
      setForm(createLocationFormState(location));
      setError(null);
    }
  }, [location, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await onSubmit({
        name: form.name.trim(),
        slug: form.slug.trim(),
        address: normalizeOptionalText(form.address),
        local_master_instance_id: normalizeOptionalText(form.local_master_instance_id),
        status: form.status,
      });
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Location konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button disabled={disabled} onClick={() => setOpen(true)} size={isEdit ? "icon-sm" : "default"} title={isEdit ? "Bearbeiten" : "Location erstellen"} type="button" variant={isEdit ? "ghost" : "default"}>
        {isEdit ? <Pencil className="size-4" /> : <MapPin className="size-4" />}
        {!isEdit ? "Location" : <span className="sr-only">Bearbeiten</span>}
      </Button>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Location bearbeiten" : "Location erstellen"}</DialogTitle>
            <DialogDescription>Eine Location ist der Standort, an den sich spaeter genau ein aktiver LocalMaster koppelt.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Name</span>
              <Input onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Slug</span>
              <Input onChange={(event) => setForm({ ...form, slug: event.target.value })} pattern="[a-z0-9-]+" required value={form.slug} />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Adresse</span>
            <Input onChange={(event) => setForm({ ...form, address: event.target.value })} value={form.address} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">LocalMaster Instance ID</span>
            <Input onChange={(event) => setForm({ ...form, local_master_instance_id: event.target.value })} value={form.local_master_instance_id} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Status</span>
            <select
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) => setForm({ ...form, status: event.target.value as LocationInput["status"] })}
              value={form.status}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </label>

          {error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <WifiOff className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">RelaySyncApi nicht erreichbar</p>
          <p className="break-words text-sm opacity-80">{message}</p>
        </div>
      </div>
      <Button onClick={onRetry} type="button" variant="outline">
        Erneut laden
      </Button>
    </div>
  );
}

type TenantFormState = {
  name: string;
  slug: string;
  email: string;
  phone: string;
  website: string;
  status: TenantInput["status"];
};

type LocationFormState = {
  name: string;
  slug: string;
  address: string;
  local_master_instance_id: string;
  status: LocationInput["status"];
};

function createTenantFormState(tenant?: Tenant): TenantFormState {
  return {
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    email: tenant?.email ?? "",
    phone: tenant?.phone ?? "",
    website: tenant?.website ?? "",
    status: tenant?.status ?? "ACTIVE",
  };
}

function createLocationFormState(location?: Location): LocationFormState {
  return {
    name: location?.name ?? "",
    slug: location?.slug ?? "",
    address: location?.address ?? "",
    local_master_instance_id: location?.local_master_instance_id ?? "",
    status: location?.status ?? "ACTIVE",
  };
}

function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default App;
