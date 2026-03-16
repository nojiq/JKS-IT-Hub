import React, { useEffect, useState } from 'react';
import { MAX_MONTHS_AHEAD, MIN_MONTHS_AHEAD } from '../utils/scheduleGeneration.js';
import './ScheduleGenerationModal.css';

const ScheduleGenerationModal = ({
    isOpen,
    cycle,
    isLoading = false,
    onSubmit,
    onClose
}) => {
    const [monthsAhead, setMonthsAhead] = useState(String(MIN_MONTHS_AHEAD));
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMonthsAhead(String(MIN_MONTHS_AHEAD));
            setError('');
        }
    }, [isOpen, cycle?.id]);

    if (!isOpen || !cycle) return null;

    const handleSubmit = (event) => {
        event.preventDefault();
        const parsed = Number.parseInt(monthsAhead, 10);

        if (!Number.isInteger(parsed) || parsed < MIN_MONTHS_AHEAD || parsed > MAX_MONTHS_AHEAD) {
            setError(`Enter a whole number from ${MIN_MONTHS_AHEAD} to ${MAX_MONTHS_AHEAD}.`);
            return;
        }

        setError('');
        onSubmit(parsed);
    };

    return (
        <div className="maintenance-window-detail-overlay" role="presentation" onClick={onClose}>
            <div className="maintenance-window-detail-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-generation-title" onClick={(event) => event.stopPropagation()}>
                <div className="maintenance-window-detail-header">
                    <h2 id="schedule-generation-title">Generate Future Schedule</h2>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
                        Close
                    </button>
                </div>

                <form className="schedule-generation-form" onSubmit={handleSubmit}>
                    <p className="schedule-generation-form__text">
                        Generate maintenance windows for <strong>{cycle.name}</strong>.
                    </p>

                    <label htmlFor="months-ahead-input" className="schedule-generation-form__label">
                        Months ahead ({MIN_MONTHS_AHEAD}-{MAX_MONTHS_AHEAD})
                    </label>
                    <input
                        id="months-ahead-input"
                        type="number"
                        min={MIN_MONTHS_AHEAD}
                        max={MAX_MONTHS_AHEAD}
                        step="1"
                        value={monthsAhead}
                        onChange={(event) => setMonthsAhead(event.target.value)}
                        disabled={isLoading}
                        className="schedule-generation-form__input"
                    />

                    {error ? <p className="schedule-generation-form__error">{error}</p> : null}

                    <div className="maintenance-window-detail-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScheduleGenerationModal;
