import React, { useState } from 'react';
import { useSubmitRequest } from '../hooks/useRequests.js';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../shared/hooks/useToast.js';
import InvoiceUploader from './InvoiceUploader.jsx';

const RequestForm = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const submitMutation = useSubmitRequest();

    const [formData, setFormData] = useState({
        itemName: '',
        description: '',
        justification: '',
        priority: 'MEDIUM',
        category: ''
    });

    const [errors, setErrors] = useState({});
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [submitProgress, setSubmitProgress] = useState(0);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error on change
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.itemName.trim()) newErrors.itemName = "Item name is required";
        if (formData.itemName.length > 200) newErrors.itemName = "Item name must be less than 200 characters";
        if (!formData.justification.trim()) newErrors.justification = "Justification is required";
        if (formData.justification.length > 1000) newErrors.justification = "Justification must be less than 1000 characters";
        if (!invoiceFile) newErrors.invoice = "E-invoice is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInvoiceSelect = (file) => {
        setInvoiceFile(file);
        if (errors.invoice) {
            setErrors(prev => ({ ...prev, invoice: null }));
        }
    };

    const handleInvoiceRemove = () => {
        setInvoiceFile(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            setSubmitProgress(0);
            await submitMutation.mutateAsync({
                data: formData,
                file: invoiceFile,
                onProgress: setSubmitProgress
            });

            toast.success("Request Submitted", "Your request was submitted successfully.");
            navigate('/requests/my-requests');
        } catch (error) {
            console.error("Submission failed", error);
            setErrors(prev => ({ ...prev, submit: error.message }));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="request-form">
            <div className="form-group">
                <label htmlFor="itemName">Item Name *</label>
                <input
                    type="text"
                    id="itemName"
                    name="itemName"
                    value={formData.itemName}
                    onChange={handleChange}
                    className={errors.itemName ? 'error' : ''}
                />
                {errors.itemName && <span className="error-msg">{errors.itemName}</span>}
            </div>

            <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                />
            </div>

            <div className="form-group">
                <label htmlFor="justification">Justification *</label>
                <textarea
                    id="justification"
                    name="justification"
                    value={formData.justification}
                    onChange={handleChange}
                    rows={4}
                    className={errors.justification ? 'error' : ''}
                />
                {errors.justification && <span className="error-msg">{errors.justification}</span>}
            </div>

            <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="category">Category</label>
                <input
                    type="text"
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                />
            </div>

            {/* Invoice Upload */}
            <div className="form-group">
                <label>E-invoice *</label>
                <InvoiceUploader
                    file={invoiceFile}
                    onFileSelect={handleInvoiceSelect}
                    onFileRemove={handleInvoiceRemove}
                    error={errors.invoice}
                    uploading={submitMutation.isPending}
                    uploadProgress={submitProgress}
                    disabled={submitMutation.isPending}
                />
            </div>

            {errors.submit && <div className="error-banner">{errors.submit}</div>}

            <div className="form-actions">
                <button type="submit" disabled={submitMutation.isPending}>
                    {submitMutation.isPending
                        ? `Submitting...${submitProgress > 0 ? ` ${submitProgress}%` : ''}`
                        : 'Submit Request'}
                </button>
                <button type="button" onClick={() => navigate(-1)} className="btn-cancel">
                    Cancel
                </button>
            </div>

            <style>{`
                .request-form {
                    max-width: 600px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    font-weight: 500;
                }
                .form-group input, .form-group textarea, .form-group select {
                    padding: 0.5rem;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                .form-group .error {
                    border-color: red;
                }
                .error-msg {
                    color: red;
                    font-size: 0.875rem;
                }
                .error-banner {
                    padding: 0.75rem;
                    background-color: #fee2e2;
                    color: #b91c1c;
                    border-radius: 4px;
                }
                .form-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                button {
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    font-weight: 500;
                    cursor: pointer;
                }
                button[type="submit"] {
                    background-color: #4f46e5;
                    color: white;
                    border: none;
                }
                button[type="submit"]:disabled {
                    background-color: #a5b4fc;
                    cursor: not-allowed;
                }
                .btn-cancel {
                    background-color: white;
                    border: 1px solid #ccc;
                }
            `}</style>
        </form>
    );
};

export default RequestForm;
