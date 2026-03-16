import { FilterPanel } from "../ui/FilterPanel/FilterPanel";
import "./workspace.css";

export function DesktopFilterBar({ contract, children }) {
  return (
    <div className="workspace-filter-bar">
      <FilterPanel
        filters={contract.filters}
        onFilterChange={contract.apply}
        onClear={contract.reset}
        ignoredKeys={contract.ignoredKeys}
      >
        {children}
      </FilterPanel>
    </div>
  );
}
