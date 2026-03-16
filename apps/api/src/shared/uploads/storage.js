import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { uploadsConfig } from '../../config/uploads.js';

/**
 * Ensure the upload directory exists
 */
export async function ensureUploadDir() {
    await fs.mkdir(uploadsConfig.uploadDir, { recursive: true });
}

/**
 * Generate a UUID-based filename preserving the original extension
 * @param {string} originalName - Original filename
 * @returns {string} UUID-based filename with preserved extension
 */
export function generateFileName(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    return `${randomUUID()}${ext}`;
}

/**
 * Save file buffer to disk
 * @param {Buffer} buffer - File content buffer
 * @param {string} fileName - Target filename
 * @returns {Promise<string>} The saved filename
 */
export async function saveFile(buffer, fileName) {
    const filePath = path.join(uploadsConfig.uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    return fileName;
}

/**
 * Delete a file from the upload directory
 * @param {string} fileName - Filename to delete
 */
export async function deleteFile(fileName) {
    const filePath = path.join(uploadsConfig.uploadDir, fileName);
    try {
        await fs.unlink(filePath);
    } catch (error) {
        // Ignore if file doesn't exist
        if (error.code !== 'ENOENT') throw error;
    }
}

/**
 * Get the absolute path for a file in the upload directory
 * @param {string} fileName - Filename
 * @returns {string} Absolute file path
 */
export function getFilePath(fileName) {
    return path.join(uploadsConfig.uploadDir, fileName);
}
