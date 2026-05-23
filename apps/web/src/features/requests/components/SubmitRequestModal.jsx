import React, { useRef, useState } from "react";
import { MobileModal } from "../../../shared/ui/MobileModal/MobileModal";
import { useSubmitPurchaseRecord } from "../hooks/useRequests.js";
import { fetchMarketplacePreview } from "../api/purchaseRecordsApi.js";
import { useToast } from "../../../shared/hooks/useToast.js";
import InvoiceUploader from "./InvoiceUploader.jsx";
import { EMPTY_PURCHASE_ITEM } from "../utils/purchaseRecordUtils.js";
import "./SubmitRequestModal.css";

const IconLink = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
);

const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IconLoader = ({ className = "" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" strokeLinecap="round" />
    </svg>
);

const FORM_STEPS = [
    { id: 1, label: "Import" },
    { id: 2, label: "Details" },
    { id: 3, label: "Items" },
    { id: 4, label: "Invoice" }
];

const ITEM_NAME_MAX_LENGTH = 200;

const createEmptyItem = () => ({ ...EMPTY_PURCHASE_ITEM });

const categoryLeaf = (categoryPath = []) => {
    const path = Array.isArray(categoryPath) ? categoryPath.filter(Boolean) : [];
    return path[path.length - 1] ?? "";
};

const variantLabel = (variant) => {
    if (!variant) return "Default";
    if (variant.label) return variant.label;
    const options = variant.options && typeof variant.options === "object"
        ? Object.values(variant.options).filter(Boolean)
        : [];
    return options.length > 0 ? options.join(" / ") : "Default";
};

const getVariantOptionGroups = (variants = []) => {
    const groupMap = new Map();
    variants.forEach((variant) => {
        const options = variant.options && typeof variant.options === "object" ? variant.options : {};
        Object.entries(options).forEach(([name, value]) => {
            if (!name || !value) return;
            if (!groupMap.has(name)) groupMap.set(name, new Map());
            const values = groupMap.get(name);
            if (!values.has(value)) {
                values.set(value, { value, imageUrl: variant.imageUrl || "" });
            } else if (!values.get(value).imageUrl && variant.imageUrl) {
                values.set(value, { value, imageUrl: variant.imageUrl });
            }
        });
    });

    return Array.from(groupMap.entries()).map(([name, values]) => ({
        name,
        values: Array.from(values.values())
    }));
};

const variantOptions = (variant) => (
    variant?.options && typeof variant.options === "object" ? variant.options : {}
);

const variantId = (variant) => variant?.skuId || variant?.modelId || variant?.itemId || "";

const normalizeCompactText = (value = "") => String(value).replace(/\s+/g, " ").trim();

const truncateText = (value, maxLength = ITEM_NAME_MAX_LENGTH) => {
    const normalized = normalizeCompactText(value);
    if (normalized.length <= maxLength) return normalized;

    const suffix = "...";
    const limit = Math.max(0, maxLength - suffix.length);
    const slice = normalized.slice(0, limit).trimEnd();
    const wordBoundary = slice.lastIndexOf(" ");
    if (wordBoundary >= Math.floor(limit * 0.65)) {
        return `${slice.slice(0, wordBoundary).trimEnd()}${suffix}`;
    }
    return `${slice}${suffix}`;
};

const compactMarketplaceItemName = (productName = "", variantText = "") => {
    const normalizedProductName = normalizeCompactText(productName);
    const normalizedVariantText = normalizeCompactText(variantText);
    if (!normalizedVariantText || normalizedVariantText === "Default") {
        return truncateText(normalizedProductName);
    }

    const suffix = ` - ${normalizedVariantText}`;
    if (suffix.length >= ITEM_NAME_MAX_LENGTH) {
        return truncateText(`${normalizedProductName}${suffix}`);
    }

    const compactProductName = truncateText(
        normalizedProductName,
        ITEM_NAME_MAX_LENGTH - suffix.length
    );
    return `${compactProductName}${suffix}`;
};

const extractUrlFromText = (value = "") => (
    value.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, "") ?? value.trim()
);

const isEmptyPurchaseItem = (item) => !item.itemName?.trim()
    && !item.category?.trim()
    && !item.description?.trim()
    && !String(item.unitCost ?? "").trim();

const SubmitRequestModal = ({ isOpen, onClose, onSuccess }) => {
    const toast = useToast();
    const submitMutation = useSubmitPurchaseRecord();
    const marketplaceFetchSeq = useRef(0);
    const formRef = useRef(null);

    const [reason, setReason] = useState("");
    const [vendorName, setVendorName] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState([createEmptyItem()]);
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [submitProgress, setSubmitProgress] = useState(0);
    const [errors, setErrors] = useState({});
    const [marketplaceUrl, setMarketplaceUrl] = useState("");
    const [marketplacePreview, setMarketplacePreview] = useState(null);
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
    const [isFetchingPreview, setIsFetchingPreview] = useState(false);
    const marketplaceVariants = marketplacePreview?.variants?.length
        ? marketplacePreview.variants
        : [{ label: "Default" }];
    const selectedVariant = marketplaceVariants[selectedVariantIndex] ?? marketplaceVariants[0] ?? {};
    const variantGroups = getVariantOptionGroups(marketplaceVariants);
    const selectedVariantOptions = selectedVariant.options && typeof selectedVariant.options === "object"
        ? selectedVariant.options
        : {};
    const selectedVariantPrice = selectedVariant.price
        ? `${selectedVariant.currency ?? marketplacePreview?.currency ?? ""} ${selectedVariant.price}`.trim()
        : "";
    const selectedVariantImage = selectedVariant.imageUrl || marketplacePreview?.imageUrl || "";
    const selectedVariantId = variantId(selectedVariant);

    const resetForm = () => {
        setReason("");
        setVendorName("");
        setNotes("");
        setItems([createEmptyItem()]);
        setInvoiceFile(null);
        setSubmitProgress(0);
        setErrors({});
        setMarketplaceUrl("");
        setMarketplacePreview(null);
        setSelectedVariantIndex(0);
        setIsFetchingPreview(false);
    };

    const handleClose = () => {
        if (submitMutation.isPending) return;
        resetForm();
        onClose?.();
    };

    const updateItem = (index, field, value) => {
        setItems((prev) => prev.map((item, i) => (
            i === index ? { ...item, [field]: value } : item
        )));
        if (errors.items?.[index]?.[field]) {
            setErrors((prev) => {
                const nextItems = [...(prev.items ?? [])];
                nextItems[index] = { ...(nextItems[index] ?? {}), [field]: null };
                return { ...prev, items: nextItems };
            });
        }
    };

    const addItem = () => {
        setItems((prev) => [...prev, createEmptyItem()]);
    };

    const removeItem = (index) => {
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const findVariantIndex = (nextOptions) => marketplaceVariants.findIndex((variant) => {
        const options = variantOptions(variant);
        return Object.entries(nextOptions).every(([name, value]) => !value || options[name] === value);
    });

    const isVariantOptionEnabled = (groupName, value) => {
        return marketplaceVariants.some((variant) => variantOptions(variant)[groupName] === value);
    };

    const isVariantOptionExact = (groupName, value) => {
        const nextOptions = { ...selectedVariantOptions, [groupName]: value };
        return findVariantIndex(nextOptions) !== -1;
    };

    const selectVariantOption = (groupName, value) => {
        const nextOptions = { ...selectedVariantOptions, [groupName]: value };
        const exactIndex = findVariantIndex(nextOptions);
        if (exactIndex !== -1) {
            setSelectedVariantIndex(exactIndex);
            return;
        }

        const fallbackIndex = marketplaceVariants.findIndex((variant) => (
            variantOptions(variant)[groupName] === value && variant.available !== false
        ));
        if (fallbackIndex !== -1) {
            setSelectedVariantIndex(fallbackIndex);
            return;
        }

        const anyIndex = marketplaceVariants.findIndex((variant) => variantOptions(variant)[groupName] === value);
        if (anyIndex !== -1) setSelectedVariantIndex(anyIndex);
    };

    const scrollFirstFormIssue = () => {
        window.setTimeout(() => {
            const target = formRef.current?.querySelector(
                ".submit-request-modal__control.is-error, .submit-request-modal__banner, .submit-request-modal__error"
            );
            target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
            target?.focus?.({ preventScroll: true });
        }, 0);
    };

    const handleFetchMarketplacePreview = async (nextUrl = marketplaceUrl) => {
        const rawUrl = typeof nextUrl === "string" ? nextUrl : marketplaceUrl;
        const url = rawUrl.trim();
        if (!url) {
            setErrors((prev) => ({ ...prev, marketplaceUrl: "Product URL is required" }));
            return;
        }

        const fetchId = marketplaceFetchSeq.current + 1;
        marketplaceFetchSeq.current = fetchId;
        setIsFetchingPreview(true);
        setMarketplacePreview(null);
        setErrors((prev) => ({ ...prev, marketplaceUrl: null, marketplacePreview: null }));
        try {
            const preview = await fetchMarketplacePreview(url);
            if (fetchId !== marketplaceFetchSeq.current) return;
            setMarketplacePreview(preview);
            setSelectedVariantIndex(0);
            if (!vendorName.trim() && preview?.vendorName) {
                setVendorName(preview.vendorName);
            }
        } catch (error) {
            if (fetchId !== marketplaceFetchSeq.current) return;
            setErrors((prev) => ({ ...prev, marketplacePreview: error.message }));
        } finally {
            if (fetchId === marketplaceFetchSeq.current) {
                setIsFetchingPreview(false);
            }
        }
    };

    const handleMarketplacePaste = (event) => {
        const pastedText = event.clipboardData?.getData("text") ?? "";
        const pastedUrl = extractUrlFromText(pastedText);
        if (!pastedUrl) return;

        event.preventDefault();
        setMarketplaceUrl(pastedUrl);
        void handleFetchMarketplacePreview(pastedUrl);
    };

    const applyMarketplacePreview = () => {
        if (!marketplacePreview) return;
        const variants = marketplacePreview.variants ?? [];
        const variant = variants[selectedVariantIndex] ?? variants[0] ?? {};
        const imageUrl = variant.imageUrl || marketplacePreview.imageUrl || "";
        const sourceUrl = variant.sourceVariantUrl || marketplacePreview.sourceUrl;
        const selectedLabel = variantLabel(variant);
        const compactItemName = compactMarketplaceItemName(marketplacePreview.name, selectedLabel);
        const sourceItem = {
            itemName: compactItemName,
            description: selectedLabel !== "Default" ? selectedLabel : "",
            category: categoryLeaf(marketplacePreview.categoryPath),
            quantity: 1,
            unitCost: variant.price ?? "",
            marketplaceSource: {
                marketplace: marketplacePreview.marketplace,
                sourceUrl,
                imageUrl: imageUrl || undefined,
                snapshot: {
                    productName: marketplacePreview.name ?? null,
                    appliedItemName: compactItemName,
                    originalSourceUrl: marketplacePreview.sourceUrl,
                    vendorName: marketplacePreview.vendorName ?? null,
                    categoryPath: marketplacePreview.categoryPath ?? [],
                    variant: {
                        label: selectedLabel,
                        options: variant.options ?? {},
                        price: variant.price ?? null,
                        currency: variant.currency ?? marketplacePreview.currency ?? null,
                        available: variant.available ?? null,
                        skuId: variant.skuId ?? null,
                        modelId: variant.modelId ?? null,
                        itemId: variant.itemId ?? null,
                        sellerId: variant.sellerId ?? null,
                        promotionId: variant.promotionId ?? null,
                        sourceVariantUrl: variant.sourceVariantUrl ?? null
                    },
                    warnings: marketplacePreview.warnings ?? [],
                    fetchedAt: marketplacePreview.fetchedAt ?? null,
                    confidence: marketplacePreview.confidence ?? null
                }
            }
        };

        setItems((prev) => {
            const emptyIndex = prev.findIndex(isEmptyPurchaseItem);
            if (emptyIndex === -1) return [...prev, sourceItem];
            return prev.map((item, index) => (index === emptyIndex ? sourceItem : item));
        });
        if (!vendorName.trim() && marketplacePreview.vendorName) {
            setVendorName(marketplacePreview.vendorName);
        }
    };

    const validate = () => {
        const nextErrors = {};
        if (!reason.trim()) nextErrors.reason = "Reason is required";
        if (reason.length > 1000) nextErrors.reason = "Reason must be under 1000 characters";

        const itemErrors = items.map((item) => {
            const rowErrors = {};
            if (!item.itemName?.trim()) rowErrors.itemName = "Item name required";
            if (item.itemName?.length > ITEM_NAME_MAX_LENGTH) rowErrors.itemName = "Item name too long";
            const qty = Number(item.quantity);
            if (!Number.isFinite(qty) || qty < 1) rowErrors.quantity = "Quantity must be at least 1";
            return rowErrors;
        });

        if (itemErrors.some((row) => Object.keys(row).length > 0)) {
            nextErrors.items = itemErrors;
        }

        if (Object.keys(nextErrors).length > 0) {
            nextErrors.form = "Fix highlighted fields before submitting.";
        }
        setErrors(nextErrors);
        const isValid = Object.keys(nextErrors).length === 0;
        if (!isValid) scrollFirstFormIssue();
        return isValid;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;

        try {
            setSubmitProgress(0);
            await submitMutation.mutateAsync({
                data: {
                    reason: reason.trim(),
                    vendorName: vendorName.trim() || undefined,
                    notes: notes.trim() || undefined,
                    items: items.map((item) => ({
                        itemName: item.itemName.trim(),
                        description: item.description?.trim() || undefined,
                        category: item.category?.trim() || undefined,
                        quantity: Number(item.quantity) || 1,
                        unitCost: item.unitCost !== "" && item.unitCost !== undefined ? String(item.unitCost) : undefined,
                        marketplaceSource: item.marketplaceSource ?? undefined
                    }))
                },
                invoice: invoiceFile ?? undefined,
                onProgress: setSubmitProgress
            });

            toast.success("Purchase Record Submitted", "Your request was recorded successfully.");
            resetForm();
            onSuccess?.();
            onClose?.();
        } catch (error) {
            setErrors((prev) => ({ ...prev, form: error.message, submit: error.message }));
            scrollFirstFormIssue();
        }
    };

    return (
        <MobileModal
            isOpen={isOpen}
            onClose={handleClose}
            containerClassName="is-wide"
            title="New Purchase Request"
            footer={(
                <div className="submit-request-modal__footer">
                    <button
                        type="button"
                        className="submit-request-modal__btn is-secondary"
                        onClick={handleClose}
                        disabled={submitMutation.isPending}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="submit-purchase-record-form"
                        className="submit-request-modal__btn is-primary"
                        disabled={submitMutation.isPending}
                    >
                        {submitMutation.isPending
                            ? `Submitting${submitProgress > 0 ? ` ${submitProgress}%` : "..."}`
                            : "Submit Request"}
                    </button>
                </div>
            )}
        >
            <form
                ref={formRef}
                id="submit-purchase-record-form"
                className="submit-request-modal"
                onSubmit={handleSubmit}
            >
                <div className="submit-request-modal__hero">
                    <p className="submit-request-modal__hero-text">
                        One purchase record, multiple line items. Paste a Shopee or Lazada link to auto-fill, or enter items manually.
                    </p>
                    <ul className="submit-request-modal__steps" aria-label="Form steps">
                        {FORM_STEPS.map((step) => (
                            <li key={step.id} className="submit-request-modal__step-pill">
                                <strong>{step.id}</strong>
                                {step.label}
                            </li>
                        ))}
                    </ul>
                </div>
                {errors.form && (
                    <div className="submit-request-modal__banner" role="alert">
                        {errors.form}
                    </div>
                )}

                <section className="submit-request-modal__section" aria-labelledby="purchase-section-import">
                    <header className="submit-request-modal__section-header">
                        <h3 id="purchase-section-import" className="submit-request-modal__section-title">
                            <span>Step 1</span>
                            <strong>Import from marketplace</strong>
                        </h3>
                    </header>
                    <p className="submit-request-modal__section-hint">
                        Optional. Paste a product URL to pull name, price, and variants.
                    </p>
                    <div className="submit-request-modal__section-body submit-request-modal__panel">
                        <div className="submit-request-modal__url-row">
                            <div className="submit-request-modal__url-field">
                                <span className="submit-request-modal__url-icon" aria-hidden="true">
                                    <IconLink />
                                </span>
                                <input
                                    type="url"
                                    className="submit-request-modal__url-input submit-request-modal__control"
                                    value={marketplaceUrl}
                                    onChange={(e) => {
                                        setMarketplaceUrl(e.target.value);
                                        if (errors.marketplaceUrl) setErrors((prev) => ({ ...prev, marketplaceUrl: null }));
                                    }}
                                    onPaste={handleMarketplacePaste}
                                    placeholder="Shopee or Lazada product URL"
                                    disabled={isFetchingPreview || submitMutation.isPending}
                                    aria-label="Product URL"
                                />
                            </div>
                            <button
                                type="button"
                                className="submit-request-modal__icon-btn"
                                onClick={handleFetchMarketplacePreview}
                                disabled={isFetchingPreview || submitMutation.isPending}
                            >
                                {isFetchingPreview ? (
                                    <>
                                        <IconLoader className="submit-request-modal__spinner" />
                                        Fetching
                                    </>
                                ) : (
                                    "Fetch"
                                )}
                            </button>
                        </div>
                        {errors.marketplaceUrl && <span className="submit-request-modal__error">{errors.marketplaceUrl}</span>}
                        {errors.marketplacePreview && <div className="submit-request-modal__banner" role="alert">{errors.marketplacePreview}</div>}
                        {marketplacePreview && (
                        <div className="marketplace-preview">
                            {selectedVariantImage && (
                                <img src={selectedVariantImage} alt="" className="marketplace-preview__image" />
                            )}
                            <div className="marketplace-preview__content">
                                <p className="marketplace-preview__title">{marketplacePreview.name}</p>
                                <div className="marketplace-preview__meta">
                                    <span className="marketplace-preview__tag">
                                        {marketplacePreview.vendorName || marketplacePreview.marketplace}
                                    </span>
                                    {marketplacePreview.categoryPath?.length > 0 && (
                                        <span className="marketplace-preview__tag">
                                            {marketplacePreview.categoryPath.join(" / ")}
                                        </span>
                                    )}
                                </div>
                                {marketplacePreview.warnings?.map((warning) => (
                                    <span key={warning} className="marketplace-preview__warning">
                                        {warning}
                                    </span>
                                ))}
                                {variantGroups.length > 0 ? (
                                    <div className="marketplace-preview__options">
                                        {variantGroups.map((group) => (
                                            <div className="marketplace-preview__option-group" key={group.name}>
                                                <div className="marketplace-preview__option-label">
                                                    <span>{group.name}</span>
                                                    <strong>{selectedVariantOptions[group.name] ?? "-"}</strong>
                                                </div>
                                                <div className="marketplace-preview__option-list">
                                                    {group.values.map((option) => {
                                                        const selected = selectedVariantOptions[group.name] === option.value;
                                                        const enabled = isVariantOptionEnabled(group.name, option.value);
                                                        const exact = isVariantOptionExact(group.name, option.value);
                                                        return (
                                                            <button
                                                                key={`${group.name}-${option.value}`}
                                                                type="button"
                                                                className={`marketplace-preview__option${selected ? " is-selected" : ""}${exact ? "" : " is-adjusting"}`}
                                                                onClick={() => selectVariantOption(group.name, option.value)}
                                                                disabled={!enabled}
                                                                aria-pressed={selected}
                                                                title={exact ? option.value : "Selects closest available combination"}
                                                            >
                                                                {option.imageUrl && <img src={option.imageUrl} alt="" />}
                                                                <span>{option.value}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <label htmlFor="marketplace-variant">Variant</label>
                                        <select
                                            id="marketplace-variant"
                                            value={selectedVariantIndex}
                                            onChange={(e) => setSelectedVariantIndex(Number(e.target.value))}
                                        >
                                            {marketplaceVariants.map((variant, index) => (
                                                <option key={`${variantLabel(variant)}-${index}`} value={index}>
                                                    {variantLabel(variant)}{variant.price ? ` · ${variant.currency ?? marketplacePreview.currency ?? ""} ${variant.price}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                )}
                                <div className="marketplace-preview__selection">
                                    <div>
                                        <span>{variantLabel(selectedVariant)}</span>
                                        {selectedVariantId && <small>SKU {selectedVariantId}</small>}
                                    </div>
                                    <strong>{selectedVariantPrice || "Price unavailable"}</strong>
                                </div>
                                <button
                                    type="button"
                                    className="submit-request-modal__btn is-primary is-block"
                                    onClick={applyMarketplacePreview}
                                >
                                    Use selected variant
                                </button>
                            </div>
                        </div>
                        )}
                    </div>
                </section>

                <section className="submit-request-modal__section" aria-labelledby="purchase-section-details">
                    <header className="submit-request-modal__section-header">
                        <h3 id="purchase-section-details" className="submit-request-modal__section-title">
                            <span>Step 2</span>
                            <strong>Purchase details</strong>
                        </h3>
                    </header>
                    <div className="submit-request-modal__section-body submit-request-modal__panel">
                        <div className="submit-request-modal__field">
                            <label htmlFor="purchase-reason">
                                Reason <span className="submit-request-modal__field-hint">(required)</span>
                            </label>
                            <textarea
                                id="purchase-reason"
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    if (errors.reason) setErrors((prev) => ({ ...prev, reason: null }));
                                }}
                                rows={3}
                                className={`submit-request-modal__control${errors.reason ? " is-error" : ""}`}
                                placeholder="Why is this purchase needed?"
                            />
                            {errors.reason && <span className="submit-request-modal__error">{errors.reason}</span>}
                        </div>

                        <div className="submit-request-modal__grid">
                            <div className="submit-request-modal__field">
                                <label htmlFor="purchase-vendor">Vendor</label>
                                <input
                                    id="purchase-vendor"
                                    type="text"
                                    className="submit-request-modal__control"
                                    value={vendorName}
                                    onChange={(e) => setVendorName(e.target.value)}
                                    placeholder="Supplier name"
                                />
                            </div>
                            <div className="submit-request-modal__field">
                                <label htmlFor="purchase-notes">Notes</label>
                                <input
                                    id="purchase-notes"
                                    type="text"
                                    className="submit-request-modal__control"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Optional context"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="submit-request-modal__section" aria-labelledby="purchase-section-items">
                    <header className="submit-request-modal__section-header">
                        <h3 id="purchase-section-items" className="submit-request-modal__section-title">
                            <span>Step 3</span>
                            <strong>Line items</strong>
                        </h3>
                        <button
                            type="button"
                            className="submit-request-modal__text-btn"
                            onClick={addItem}
                        >
                            <IconPlus />
                            Add item
                        </button>
                    </header>
                    <div className="submit-request-modal__section-body submit-request-modal__items-panel">
                    {items.map((item, index) => (
                        <article key={index} className="submit-request-modal__item-card">
                            <div className="submit-request-modal__item-card-header">
                                <div className="submit-request-modal__item-badge">
                                    <span>{index + 1}</span>
                                    Item {index + 1}
                                </div>
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        className="submit-request-modal__text-btn is-danger"
                                        onClick={() => removeItem(index)}
                                    >
                                        <IconTrash />
                                        Remove
                                    </button>
                                )}
                            </div>

                            <div className="submit-request-modal__field">
                                <label htmlFor={`item-name-${index}`}>Item name *</label>
                                <input
                                    id={`item-name-${index}`}
                                    type="text"
                                    value={item.itemName}
                                    maxLength={ITEM_NAME_MAX_LENGTH}
                                    onChange={(e) => updateItem(index, "itemName", e.target.value)}
                                    className={`submit-request-modal__control${errors.items?.[index]?.itemName ? " is-error" : ""}`}
                                />
                                {errors.items?.[index]?.itemName && (
                                    <span className="submit-request-modal__error">
                                        {errors.items[index].itemName}
                                    </span>
                                )}
                            </div>

                            <div className="submit-request-modal__grid submit-request-modal__grid--triple">
                                <div className="submit-request-modal__field">
                                    <label htmlFor={`item-qty-${index}`}>Qty</label>
                                    <input
                                        id={`item-qty-${index}`}
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                                        className={`submit-request-modal__control${errors.items?.[index]?.quantity ? " is-error" : ""}`}
                                    />
                                </div>
                                <div className="submit-request-modal__field">
                                    <label htmlFor={`item-category-${index}`}>Category</label>
                                    <input
                                        id={`item-category-${index}`}
                                        type="text"
                                        className="submit-request-modal__control"
                                        value={item.category}
                                        onChange={(e) => updateItem(index, "category", e.target.value)}
                                    />
                                </div>
                                <div className="submit-request-modal__field">
                                    <label htmlFor={`item-unit-cost-${index}`}>Unit price</label>
                                    <input
                                        id={`item-unit-cost-${index}`}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="submit-request-modal__control"
                                        value={item.unitCost}
                                        onChange={(e) => updateItem(index, "unitCost", e.target.value)}
                                    />
                                </div>
                            </div>

                            {item.marketplaceSource?.imageUrl && (
                                <div className="submit-request-modal__source-preview">
                                    <img src={item.marketplaceSource.imageUrl} alt="" />
                                    <div>
                                        <span>{item.marketplaceSource.marketplace}</span>
                                        <a href={item.marketplaceSource.sourceUrl} target="_blank" rel="noreferrer">
                                            Source product
                                        </a>
                                    </div>
                                </div>
                            )}

                            <div className="submit-request-modal__field">
                                <label htmlFor={`item-description-${index}`}>Description</label>
                                <textarea
                                    id={`item-description-${index}`}
                                    rows={2}
                                    className="submit-request-modal__control"
                                    value={item.description}
                                    onChange={(e) => updateItem(index, "description", e.target.value)}
                                />
                            </div>
                        </article>
                    ))}
                    </div>
                </section>

                <section className="submit-request-modal__section" aria-labelledby="purchase-section-invoice">
                    <header className="submit-request-modal__section-header">
                        <h3 id="purchase-section-invoice" className="submit-request-modal__section-title">
                            <span>Step 4</span>
                            <strong>E-invoice</strong>
                        </h3>
                    </header>
                    <p className="submit-request-modal__section-hint">Optional. Attach PDF or image up to 5MB.</p>
                    <div className="submit-request-modal__section-body submit-request-modal__panel">
                        <InvoiceUploader
                            file={invoiceFile}
                            onFileSelect={setInvoiceFile}
                            onFileRemove={() => setInvoiceFile(null)}
                            uploading={submitMutation.isPending}
                            uploadProgress={submitProgress}
                            disabled={submitMutation.isPending}
                        />
                    </div>
                </section>

                {errors.submit && (
                    <div className="submit-request-modal__banner" role="alert">
                        {errors.submit}
                    </div>
                )}
            </form>
        </MobileModal>
    );
};

export default SubmitRequestModal;
