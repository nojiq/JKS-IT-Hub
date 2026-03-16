// Upload configuration for file handling
export const uploadsConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp'
    ],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    uploadDir: process.env.UPLOAD_DIR || './uploads'
};
