import { useEffect, useId, useRef, useState } from 'react';

export function MaintenanceRowActions({
    window,
    onView,
    onSignOff,
    onEdit,
    onAssign,
    onCancel,
    compact = false
}) {
    const menuId = useId();
    const containerRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const isTerminalStatus = window.status === 'CANCELLED' || window.status === 'COMPLETED';

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isOpen]);

    const items = [
        onView && { key: 'view', label: 'View details', onClick: () => onView(window) },
        !isTerminalStatus && onSignOff && { key: 'signoff', label: 'Sign-off', onClick: () => onSignOff(window), primary: true },
        !isTerminalStatus && onAssign && {
            key: 'assign',
            label: window.assignedTo ? 'Reassign' : 'Assign',
            onClick: () => onAssign(window)
        },
        !isTerminalStatus && onEdit && { key: 'edit', label: 'Edit', onClick: () => onEdit(window) },
        !isTerminalStatus && onCancel && { key: 'cancel', label: 'Cancel', onClick: () => onCancel(window), danger: true }
    ].filter(Boolean);

    if (!items.length) {
        return null;
    }

    if (compact && items.length <= 2) {
        return (
            <div className="maintenance-row-actions maintenance-row-actions--inline">
                {items.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={`workspace-inline-button${item.primary ? ' is-primary' : ''}${item.danger ? ' is-danger' : ''}`}
                        onClick={item.onClick}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        );
    }

    const primaryAction = items.find((item) => item.primary) || items[0];
    const menuItems = items.filter((item) => item.key !== primaryAction.key);

    return (
        <div className="maintenance-row-actions" ref={containerRef}>
            <button
                type="button"
                className={`workspace-inline-button${primaryAction.primary ? ' is-primary' : ''}`}
                onClick={primaryAction.onClick}
            >
                {primaryAction.label}
            </button>
            {menuItems.length > 0 ? (
                <>
                    <button
                        type="button"
                        className="workspace-inline-button maintenance-row-actions__menu-trigger"
                        aria-expanded={isOpen}
                        aria-haspopup="menu"
                        aria-controls={menuId}
                        onClick={() => setIsOpen((open) => !open)}
                    >
                        More
                    </button>
                    {isOpen ? (
                        <ul id={menuId} className="maintenance-row-actions__menu" role="menu">
                            {menuItems.map((item) => (
                                <li key={item.key} role="none">
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className={item.danger ? 'is-danger' : undefined}
                                        onClick={() => {
                                            item.onClick();
                                            setIsOpen(false);
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
