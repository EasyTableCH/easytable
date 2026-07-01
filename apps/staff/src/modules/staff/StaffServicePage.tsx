import type { StaffScreen, StaffTableContext } from "../../layout/navigation";
import { StaffOrderScreen } from "./StaffOrderScreen";
import { StaffPickupsScreen } from "./StaffPickupsScreen";
import { StaffTablePlanScreen } from "./StaffTablePlanScreen";

type StaffServicePageProps = {
  screen: StaffScreen;
  tableContext: StaffTableContext | null;
  onSelectTable: (tableContext: StaffTableContext) => void;
  onBackToTables: () => void;
};

export function StaffServicePage({
  screen,
  tableContext,
  onSelectTable,
  onBackToTables,
}: StaffServicePageProps) {
  if (screen === "order" && tableContext) {
    return (
      <StaffOrderScreen
        tableContext={tableContext}
        onBackToTables={onBackToTables}
      />
    );
  }

  if (screen === "pickups") {
    return <StaffPickupsScreen />;
  }

  return <StaffTablePlanScreen onSelectTable={onSelectTable} />;
}
