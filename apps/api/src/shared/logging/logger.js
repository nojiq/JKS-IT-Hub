
// Simple logger implementation
// In a real app, this might wrap Pino or similar
export const log = {
    info: (message, context) => console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : ''),
    warn: (message, context) => console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : ''),
    error: (message, context) => console.error(`[ERROR] ${message}`, context ? JSON.stringify(context) : ''),
    debug: (message, context) => console.debug(`[DEBUG] ${message}`, context ? JSON.stringify(context) : '')
};
