import { MaintenanceWindowsTable } from './MaintenanceWindowsTable.jsx';
import './MaintenanceWindowList.css';

const MaintenanceWindowList = ({
    windows,
    meta,
    onPageChange,
    onView,
    onEdit,
    onCancel,
    onSignOff,
    onAssign,
    dense = false,
    highlightedWindowId = null
}) => {
    if (!windows || windows.length === 0) {
        return <div className="maintenance-table-empty">No maintenance windows found.</div>;
    }

    const { page, totalPages } = meta || { page: 1, totalPages: 1 };

    return (
        <div className="maintenance-window-list">
            <MaintenanceWindowsTable
                windows={windows}
                dense={dense}
                highlightedWindowId={highlightedWindowId}
                onView={onView}
                onEdit={onEdit}
                onCancel={onCancel}
                onSignOff={onSignOff}
                onAssign={onAssign}
            />

            {totalPages > 1 ? (
                <div className="maintenance-pagination-bar">
                    <p className="maintenance-pagination-summary">
                        Page {page} of {totalPages}
                    </p>
                    <div className="maintenance-pagination-controls">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => onPageChange(page - 1)}
                            className="workspace-inline-button"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => onPageChange(page + 1)}
                            className="workspace-inline-button"
                        >
                            Next
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default MaintenanceWindowList;
