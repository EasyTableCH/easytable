import { useEffect, useState, type FormEvent } from "react";
import { Pencil, RadioTower } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@easytable/ui/components/switch";

import type { OutputStation, OutputStationInput } from "../../../lib/relay-sync-api";
import { createOutputStationFormState } from "../utils";

type OutputStationFormDialogProps = {
  station?: OutputStation;
  mode: "create" | "edit";
  disabled?: boolean;
  onSubmit: (input: OutputStationInput) => Promise<void>;
};

export function OutputStationFormDialog({ station, mode, disabled = false, onSubmit }: OutputStationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => createOutputStationFormState(station));
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = mode === "edit";

  useEffect(() => {
    if (open) {
      setForm(createOutputStationFormState(station));
    }
  }, [open, station]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await onSubmit({
        name: form.name.trim(),
        has_kds: form.has_kds,
        has_printer: form.has_printer,
        is_active: form.is_active,
        sort_order: Number(form.sort_order),
      });
      setOpen(false);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Station konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button disabled={disabled} onClick={() => setOpen(true)} size={isEdit ? "icon-sm" : "default"} title={isEdit ? "Bearbeiten" : "Station erstellen"} type="button" variant={isEdit ? "ghost" : "default"}>
        {isEdit ? <Pencil className="size-4" /> : <RadioTower className="size-4" />}
        {!isEdit ? "Station" : <span className="sr-only">Bearbeiten</span>}
      </Button>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Station bearbeiten" : "Station erstellen"}</DialogTitle>
            <DialogDescription>Stationen definieren KDS- und Bondrucker-Ausgabe fuer eine Location.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Name</span>
              <Input onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
            </label>
            <label className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">KDS</span>
              <Switch checked={form.has_kds} onCheckedChange={(checked) => setForm({ ...form, has_kds: checked })} />
            </label>
          </div>
          <label className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm font-medium">Bondrucker</span>
            <Switch checked={form.has_printer} onCheckedChange={(checked) => setForm({ ...form, has_printer: checked })} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Sortierung</span>
            <Input min="0" onChange={(event) => setForm({ ...form, sort_order: event.target.value })} required type="number" value={form.sort_order} />
          </label>
          <label className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm font-medium">Aktiv</span>
            <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
          </label>

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
