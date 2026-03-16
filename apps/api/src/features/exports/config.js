export const FORMAT_TYPES = {
    STANDARD: 'standard',
    COMPRESSED: 'compressed'
};

export const DEFAULT_FORMAT = FORMAT_TYPES.STANDARD;

export const FORMAT_CONFIG = {
    STANDARD: {
        type: FORMAT_TYPES.STANDARD,
        label: 'Standard (Human-readable)',
        contentType: 'text/plain; charset=utf-8',
        extension: 'txt',
        delimiters: {
            entry: '---------------------------------',
            section: '=================================',
            field: null // text based
        }
    },
    COMPRESSED: {
        type: FORMAT_TYPES.COMPRESSED,
        label: 'Compressed (CSV-style)',
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
        delimiters: {
            entry: '\n',
            section: '\n', // just lines
            field: '|'
        }
    }
};

export const getExportFormat = (formatType) => {
    const normalizedType = String(formatType).toLowerCase();

    if (normalizedType === FORMAT_TYPES.COMPRESSED) {
        return FORMAT_CONFIG.COMPRESSED;
    }

    return FORMAT_CONFIG.STANDARD;
};
