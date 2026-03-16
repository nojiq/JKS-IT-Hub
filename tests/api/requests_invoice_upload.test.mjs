import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test upload directory
const TEST_UPLOAD_DIR = join(__dirname, '../../apps/api/test-uploads');

// Helper to create a minimal test file buffer
function createTestFileBuffer(content = 'test file content', size = null) {
    if (size) {
        // Create buffer of specific size
        return Buffer.alloc(size, 'x');
    }
    return Buffer.from(content);
}

// Helper to create a mock multipart file object
function createMockFile(options = {}) {
    const {
        filename = 'test-invoice.pdf',
        mimetype = 'application/pdf',
        content = 'test pdf content',
        size = null
    } = options;

    const buffer = size ? Buffer.alloc(size, 'x') : Buffer.from(content);

    return {
        filename,
        mimetype,
        size: buffer.length,
        buffer
    };
}

describe('Invoice Upload - Storage Utilities', () => {
    let storage;

    before(async () => {
        // Set test upload directory
        process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

        // Import storage module
        storage = await import('../../apps/api/src/shared/uploads/storage.js');
    });

    beforeEach(async () => {
        // Clean up test upload directory before each test
        try {
            await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
        } catch (err) {
            // Directory may not exist
        }
    });

    after(async () => {
        // Clean up test upload directory
        try {
            await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
        } catch (err) {
            // Directory may not exist
        }
    });

    it('should ensure upload directory exists', async () => {
        await storage.ensureUploadDir();

        const stats = await fs.stat(TEST_UPLOAD_DIR);
        assert.ok(stats.isDirectory(), 'Upload directory should exist');
    });

    it('should generate UUID-based filename preserving extension', () => {
        const originalName = 'my-invoice.pdf';
        const generatedName = storage.generateFileName(originalName);

        assert.ok(generatedName.endsWith('.pdf'), 'Should preserve .pdf extension');
        assert.notStrictEqual(generatedName, originalName, 'Should not be the same as original');
        assert.match(generatedName, /^[0-9a-f-]+\.pdf$/, 'Should be UUID format');
    });

    it('should generate UUID-based filename for image files', () => {
        const originalName = 'receipt.PNG';
        const generatedName = storage.generateFileName(originalName);

        assert.ok(generatedName.endsWith('.png'), 'Should preserve lowercase extension');
        assert.match(generatedName, /^[0-9a-f-]+\.png$/, 'Should be UUID format');
    });

    it('should save file to disk', async () => {
        await storage.ensureUploadDir();

        const buffer = createTestFileBuffer('test content');
        const fileName = 'test-file.pdf';

        const savedName = await storage.saveFile(buffer, fileName);

        assert.strictEqual(savedName, fileName, 'Should return the filename');

        const filePath = storage.getFilePath(fileName);
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        assert.ok(fileExists, 'File should exist on disk');

        const content = await fs.readFile(filePath, 'utf8');
        assert.strictEqual(content, 'test content', 'File content should match');
    });

    it('should delete file from disk', async () => {
        await storage.ensureUploadDir();

        // Create a file first
        const buffer = createTestFileBuffer('to be deleted');
        const fileName = 'to-delete.pdf';
        await storage.saveFile(buffer, fileName);

        // Verify it exists
        const filePath = storage.getFilePath(fileName);
        let fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        assert.ok(fileExists, 'File should exist before deletion');

        // Delete it
        await storage.deleteFile(fileName);

        // Verify it's gone
        fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        assert.ok(!fileExists, 'File should not exist after deletion');
    });

    it('should not throw when deleting non-existent file', async () => {
        await storage.ensureUploadDir();

        // Should not throw
        await storage.deleteFile('non-existent-file.pdf');
    });

    it('should get correct file path', () => {
        const fileName = 'test-file.pdf';
        const filePath = storage.getFilePath(fileName);

        assert.ok(filePath.includes(TEST_UPLOAD_DIR), 'Path should include upload directory');
        assert.ok(filePath.endsWith(fileName), 'Path should end with filename');
    });
});

describe('Invoice Upload - Validation Utilities', () => {
    let validation;

    before(async () => {
        validation = await import('../../apps/api/src/shared/uploads/validation.js');
    });

    describe('validateFileType', () => {
        it('should accept PDF files', () => {
            assert.ok(validation.validateFileType('application/pdf'));
        });

        it('should accept PNG files', () => {
            assert.ok(validation.validateFileType('image/png'));
        });

        it('should accept JPEG files', () => {
            assert.ok(validation.validateFileType('image/jpeg'));
        });

        it('should accept WebP files', () => {
            assert.ok(validation.validateFileType('image/webp'));
        });

        it('should reject executable files', () => {
            assert.ok(!validation.validateFileType('application/x-msdownload'));
        });

        it('should reject zip files', () => {
            assert.ok(!validation.validateFileType('application/zip'));
        });

        it('should reject text files', () => {
            assert.ok(!validation.validateFileType('text/plain'));
        });

        it('should reject HTML files', () => {
            assert.ok(!validation.validateFileType('text/html'));
        });
    });

    describe('validateFileSize', () => {
        it('should accept files under 5MB', () => {
            assert.ok(validation.validateFileSize(1024)); // 1KB
            assert.ok(validation.validateFileSize(1024 * 1024)); // 1MB
            assert.ok(validation.validateFileSize(4 * 1024 * 1024)); // 4MB
        });

        it('should accept files exactly 5MB', () => {
            assert.ok(validation.validateFileSize(5 * 1024 * 1024));
        });

        it('should reject files over 5MB', () => {
            assert.ok(!validation.validateFileSize(5 * 1024 * 1024 + 1));
            assert.ok(!validation.validateFileSize(10 * 1024 * 1024));
        });
    });

    describe('validateInvoiceFile', () => {
        it('should return empty array for valid PDF', () => {
            const file = createMockFile({ mimetype: 'application/pdf' });
            const errors = validation.validateInvoiceFile(file);
            assert.strictEqual(errors.length, 0);
        });

        it('should return empty array for valid PNG', () => {
            const file = createMockFile({ mimetype: 'image/png', filename: 'invoice.png' });
            const errors = validation.validateInvoiceFile(file);
            assert.strictEqual(errors.length, 0);
        });

        it('should return error for invalid file type', () => {
            const file = createMockFile({ mimetype: 'application/zip', filename: 'invoice.zip' });
            const errors = validation.validateInvoiceFile(file);

            assert.strictEqual(errors.length, 1);
            assert.strictEqual(errors[0].field, 'invoice');
            assert.ok(errors[0].message.includes('Invalid file type'));
        });

        it('should return error for file too large', () => {
            const file = createMockFile({ size: 6 * 1024 * 1024 }); // 6MB
            const errors = validation.validateInvoiceFile(file);

            assert.strictEqual(errors.length, 1);
            assert.strictEqual(errors[0].field, 'invoice');
            assert.ok(errors[0].message.includes('too large'));
        });

        it('should return multiple errors for invalid type and size', () => {
            const file = {
                filename: 'malware.exe',
                mimetype: 'application/x-msdownload',
                size: 10 * 1024 * 1024, // 10MB
                buffer: Buffer.alloc(10 * 1024 * 1024)
            };
            const errors = validation.validateInvoiceFile(file);

            assert.strictEqual(errors.length, 2);
        });
    });
});

describe('Invoice Upload - Uploads Config', () => {
    it('should export correct configuration', async () => {
        const { uploadsConfig } = await import('../../apps/api/src/config/uploads.js');

        assert.strictEqual(uploadsConfig.maxFileSize, 5 * 1024 * 1024, 'Max file size should be 5MB');
        assert.ok(Array.isArray(uploadsConfig.allowedMimeTypes), 'Should have allowed MIME types array');
        assert.ok(uploadsConfig.allowedMimeTypes.includes('application/pdf'), 'Should allow PDF');
        assert.ok(uploadsConfig.allowedMimeTypes.includes('image/png'), 'Should allow PNG');
        assert.ok(uploadsConfig.allowedMimeTypes.includes('image/jpeg'), 'Should allow JPEG');
        assert.ok(uploadsConfig.allowedMimeTypes.includes('image/webp'), 'Should allow WebP');
    });
});
