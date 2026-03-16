import { uploadsConfig } from '../../config/uploads.js';

/**
 * Validate file MIME type against allowed types
 * @param {string} mimetype - File MIME type
 * @returns {boolean} True if valid
 */
export function validateFileType(mimetype) {
    return uploadsConfig.allowedMimeTypes.includes(mimetype);
}

/**
 * Validate file size against maximum allowed
 * @param {number} size - File size in bytes
 * @returns {boolean} True if valid
 */
export function validateFileSize(size) {
    return size <= uploadsConfig.maxFileSize;
}

/**
 * Validate invoice file for type and size
 * @param {Object} file - File object with mimetype and size properties
 * @returns {Array} Array of error objects (empty if valid)
 */
export function validateInvoiceFile(file) {
    const errors = [];

    if (!validateFileType(file.mimetype)) {
        errors.push({
            field: 'invoice',
            message: 'Invalid file type. Allowed: PDF, PNG, JPG, JPEG, WEBP'
        });
    }

    if (!validateFileSize(file.size)) {
        const maxMB = uploadsConfig.maxFileSize / (1024 * 1024);
        errors.push({
            field: 'invoice',
            message: `File too large. Maximum size: ${maxMB}MB`
        });
    }

    return errors;
}
