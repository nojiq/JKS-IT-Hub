import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import './InvoiceUploader.css';

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.webp';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_COMPRESSION_TRIGGER_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Invoice Uploader Component
 * 
 * Features:
 * - Desktop: Drag & drop with dropzone
 * - Mobile: Camera capture or file selection
 * - File preview (thumbnail for images, icon for PDFs)
 * - Client-side validation (type & size)
 * - Upload progress indicator
 */
const InvoiceUploader = ({
    file,
    onFileSelect,
    onFileRemove,
    error,
    uploading = false,
    uploadProgress = 0,
    disabled = false
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [localError, setLocalError] = useState(null);
    const inputRef = useRef(null);

    const validateFile = useCallback((f) => {
        if (!ALLOWED_TYPES.includes(f.type)) {
            return 'Invalid file type. Allowed: PDF, PNG, JPG, JPEG, WEBP';
        }
        if (f.size > MAX_FILE_SIZE) {
            return 'File too large. Maximum size: 5MB';
        }
        return null;
    }, []);

    const compressImageIfNeeded = useCallback(async (inputFile) => {
        if (!inputFile.type.startsWith('image/') || inputFile.size <= IMAGE_COMPRESSION_TRIGGER_BYTES) {
            return inputFile;
        }

        const imageUrl = URL.createObjectURL(inputFile);
        try {
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Unable to process image'));
                img.src = imageUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            if (!context) {
                return inputFile;
            }

            context.drawImage(image, 0, 0);

            const outputType = inputFile.type === 'image/png' ? 'image/jpeg' : inputFile.type;
            let quality = 0.9;
            while (quality >= 0.45) {
                // eslint-disable-next-line no-await-in-loop
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, quality));
                if (!blob) break;
                if (blob.size <= MAX_FILE_SIZE) {
                    const normalizedName = outputType === 'image/jpeg' && inputFile.name.toLowerCase().endsWith('.png')
                        ? inputFile.name.replace(/\.png$/i, '.jpg')
                        : inputFile.name;
                    return new File([blob], normalizedName, { type: outputType });
                }
                quality -= 0.1;
            }

            return inputFile;
        } finally {
            URL.revokeObjectURL(imageUrl);
        }
    }, []);

    const handleFile = useCallback(async (f) => {
        setLocalError(null);
        const candidateFile = await compressImageIfNeeded(f);
        const validationError = validateFile(candidateFile);
        if (validationError) {
            setLocalError(validationError);
            return;
        }
        onFileSelect(candidateFile);
    }, [compressImageIfNeeded, onFileSelect, validateFile]);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (disabled) return;

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            void handleFile(e.dataTransfer.files[0]);
        }
    }, [disabled, handleFile]);

    const handleChange = useCallback((e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            void handleFile(e.target.files[0]);
        }
    }, [handleFile]);

    const handleRemove = useCallback(() => {
        setLocalError(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        onFileRemove();
    }, [onFileRemove]);

    const openFilePicker = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const displayError = error || localError;
    const isPDF = file?.type === 'application/pdf';
    const isImage = file?.type?.startsWith('image/');

    // Generate preview URL for images
    const previewUrl = useMemo(() => (file && isImage ? URL.createObjectURL(file) : null), [file, isImage]);
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    return (
        <div className={`invoice-uploader ${disabled ? 'disabled' : ''}`}>
            {!file ? (
                // Dropzone / Upload area
                <div
                    className={`dropzone ${dragActive ? 'drag-active' : ''} ${displayError ? 'has-error' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={openFilePicker}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ALLOWED_EXTENSIONS}
                        capture="environment"
                        onChange={handleChange}
                        className="file-input"
                        disabled={disabled}
                    />
                    <div className="dropzone-content">
                        <div className="upload-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M12 16V4m0 0L8 8m4-4l4 4" />
                                <path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
                            </svg>
                        </div>

                        {/* Desktop message */}
                        <p className="desktop-text">
                            Drag and drop your invoice, or <span className="browse-link">click to browse</span>
                        </p>

                        {/* Mobile message */}
                        <p className="mobile-text">
                            Tap to capture or upload invoice
                        </p>

                        <p className="file-hint">PDF, PNG, JPG, JPEG, WEBP (max 5MB)</p>
                    </div>
                </div>
            ) : (
                // File preview
                <div className="file-preview">
                    {uploading ? (
                        <div className="upload-progress">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <span className="progress-text">Uploading... {uploadProgress}%</span>
                        </div>
                    ) : (
                        <>
                            {isPDF ? (
                                <div className="pdf-preview">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error-text)" strokeWidth="1.5">
                                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                        <path d="M14 2v6h6" />
                                        <path d="M10 13h4" />
                                        <path d="M10 17h4" />
                                    </svg>
                                    <span className="file-name">{file.name}</span>
                                </div>
                            ) : isImage && previewUrl ? (
                                <div className="image-preview">
                                    <img
                                        src={previewUrl}
                                        alt="Invoice preview"
                                        className="preview-thumbnail"
                                    />
                                    <span className="file-name">{file.name}</span>
                                </div>
                            ) : null}

                            <button
                                type="button"
                                className="remove-btn"
                                onClick={handleRemove}
                                disabled={disabled}
                            >
                                Remove
                            </button>
                        </>
                    )}
                </div>
            )}

            {displayError && (
                <p className="error-message">{displayError}</p>
            )}
        </div>
    );
};

export default InvoiceUploader;
