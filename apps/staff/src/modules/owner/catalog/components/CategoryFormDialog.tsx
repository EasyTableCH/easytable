import { useEffect, useState } from "react";
import { Copy, Pencil, Plus } from "lucide-react";

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

import type { CatalogCategory, CatalogCategoryInput, CatalogOutputStation } from "../../../../lib/local-master";

type CategoryFormDialogProps = {
  category?: CatalogCategory;
  outputStations: CatalogOutputStation[];
  mode: "create" | "edit";
  onSubmit: (input: CatalogCategoryInput) => Promise<void>;
};

type CategoryFormState = {
  name: string;
  sort_order: string;
  default_station_id: string;
};

export function CategoryFormDialog({ category, outputStations, mode, onSubmit }: CategoryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CategoryFormState>(() => createInitialState(category));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = mode === "edit";

  useEffect(() => {
    if (open) {
      setForm(createInitialState(category));
      setError(null);
    }
  }, [category, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await onSubmit({
        name: form.name.trim(),
        sort_order: Number(form.sort_order),
        default_station_id: form.default_station_id || null,
      });
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Kategorie konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)} size={isEdit ? "icon-sm" : "default"} title={isEdit ? "Bearbeiten" : "Kategorie erstellen"} type="button" variant={isEdit ? "ghost" : "default"}>
        {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        {!isEdit ? "Kategorie" : <span className="sr-only">Bearbeiten</span>}
      </Button>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Kategorie bearbeiten" : "Kategorie erstellen"}</DialogTitle>
            <DialogDescription>Kategorien werden lokal im LocalMaster gespeichert.</DialogDescription>
          </DialogHeader>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <Input onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Sortierung</span>
            <Input min="0" onChange={(event) => setForm({ ...form, sort_order: event.target.value })} required type="number" value={form.sort_order} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Standard-Station</span>
            <select
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) => setForm({ ...form, default_station_id: event.target.value })}
              value={form.default_station_id}
            >
              <option value="">Keine Station</option>
              {outputStations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
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

export function DuplicateCategoryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} size="icon-sm" title="Kopieren" type="button" variant="ghost">
      <Copy className="size-4" />
      <span className="sr-only">Kopieren</span>
    </Button>
  );
}

function createInitialState(category?: CatalogCategory): CategoryFormState {
  return {
    name: category?.name ?? "",
    sort_order: String(category?.sort_order ?? 10),
    default_station_id: category?.default_station_id ?? "",
  };
}
