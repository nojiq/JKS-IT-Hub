
import React from 'react';
import MaintenanceWindowCard from "./MaintenanceWindowCard.jsx";
import './MaintenanceWindowList.css';

const groupByCycle = (windows = []) => {
    const map = new Map();
    for (const window of windows) {
        const cycleId = window.cycleConfig?.id || 'ad-hoc';
        const cycleName = window.cycleConfig?.name || 'Ad-hoc Windows';
        if (!map.has(cycleId)) {
            map.set(cycleId, { cycleId, cycleName, windows: [] });
        }
        map.get(cycleId).windows.push(window);
    }
    return Array.from(map.values());
};

const MaintenanceWindowList = ({ windows, meta, onPageChange, onView, onEdit, onCancel, onSignOff, onAssign }) => {
    if (!windows || windows.length === 0) {
        return <div className="window-list-empty">No maintenance windows found.</div>;
    }

    const { page, totalPages } = meta || { page: 1, totalPages: 1 };
    const groupedWindows = groupByCycle(windows);

    return (
        <div className="window-list-container">
            {groupedWindows.map((group) => (
                <section key={group.cycleId} className="window-group">
                    <header className="window-group__header">
                        <h2>{group.cycleName}</h2>
                        <span>{group.windows.length} window(s)</span>
                    </header>
                    <div className="window-card-grid">
                        {group.windows.map((window) => (
                            <MaintenanceWindowCard
                                key={window.id}
                                window={window}
                                onView={onView}
                                onEdit={onEdit}
                                onCancel={onCancel}
                                onSignOff={onSignOff}
                                onAssign={onAssign}
                            />
                        ))}
                    </div>
                </section>
            ))}

            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                        className="btn-secondary"
                    >
                        Previous
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                        className="btn-secondary"
                    >
                        Next
                    </button>
                </div>
            )}
        </div >
    );
};

export default MaintenanceWindowList;
