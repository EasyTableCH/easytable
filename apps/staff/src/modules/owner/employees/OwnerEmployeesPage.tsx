import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  archiveOwnerUserForConnection,
  createOwnerUserForConnection,
  deleteOwnerUserForConnection,
  detectConnectionMode,
  loadOwnerUsersForConnection,
  resetOwnerUserPasswordForConnection,
  resetOwnerUserPinForConnection,
  updateOwnerUserForConnection,
  type ConnectionMode,
  type TenantLocationUser,
  type TenantLocationUserInput,
} from "../../../lib/local-master";
import { EmployeesView } from "./EmployeesView";

export function OwnerEmployeesPage() {
  const [users, setUsers] = useState<TenantLocationUser[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("OFFLINE");
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const nextMode = await detectConnectionMode();
      setConnectionMode(nextMode);
      setUsers(await loadOwnerUsersForConnection(nextMode));
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Mitarbeiter konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function runUserAction<T>(action: () => Promise<T>): Promise<T> {
    try {
      const result = await action();
      await refreshUsers();
      return result;
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Mitarbeiter-Aktion fehlgeschlagen.");
      throw actionError;
    }
  }

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <EmployeesView
        isLoading={isLoading}
        onArchive={(userId) =>
          runUserAction(async () => void (await archiveOwnerUserForConnection(connectionMode, userId)))
        }
        onCreate={(input: TenantLocationUserInput) => runUserAction(async () => void (await createOwnerUserForConnection(connectionMode, input)))}
        onDelete={(userId) =>
          runUserAction(async () => void (await deleteOwnerUserForConnection(connectionMode, userId)))
        }
        onReload={refreshUsers}
        onResetPassword={(userId) =>
          runUserAction(async () => void (await resetOwnerUserPasswordForConnection(connectionMode, userId)))
        }
        onResetPin={(userId) =>
          runUserAction(async () => {
            const result = await resetOwnerUserPinForConnection(connectionMode, userId);
            return result.generated_pin;
          })
        }
        onUpdate={(userId, input) =>
          runUserAction(async () => void (await updateOwnerUserForConnection(connectionMode, userId, input)))
        }
        users={users}
      />
    </div>
  );
}
