import { EventEmitter } from 'events';

// Global event bus for domain events
export const domainEvents = new EventEmitter();

// Optional: Log events in dev
if (process.env.NODE_ENV !== 'production') {
    const originalEmit = domainEvents.emit;
    domainEvents.emit = function (type, ...args) {
        console.log(`[DomainEvent] ${type}`, args);
        return originalEmit.apply(this, [type, ...args]);
    };
}
