import { useState } from "react";

import { AppLayout } from "./layout/AppLayout";
import { defaultView, type AppView } from "./layout/navigation";
import { OwnerCatalogPage } from "./modules/owner/catalog/OwnerCatalogPage";
import { ModulePlaceholder } from "./modules/placeholder/ModulePlaceholder";
import { KdsPage } from "./modules/kds/KdsPage";
import { StaffServicePage } from "./modules/staff/StaffServicePage";

function App() {
  const [view, setView] = useState<AppView>(defaultView);

  return (
    <AppLayout onNavigate={setView} view={view}>
      {view.module === "owner" ? (
        <OwnerCatalogPage section={view.ownerSection} />
      ) : view.module === "staff" ? (
        <StaffServicePage
          screen={view.staffScreen}
          tableContext={view.tableContext}
          onBackToTables={() =>
            setView((current) => ({
              ...current,
              module: "staff",
              staffScreen: "orders",
              tableContext: null,
            }))
          }
          onSelectTable={(tableContext) =>
            setView((current) => ({
              ...current,
              module: "staff",
              staffScreen: "order",
              tableContext,
            }))
          }
        />
      ) : view.module === "kds" ? (
        <KdsPage />
      ) : (
        <ModulePlaceholder module={view.module} />
      )}
    </AppLayout>
  );
}

export default App;
