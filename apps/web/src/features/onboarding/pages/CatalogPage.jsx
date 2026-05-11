import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "../../../shared/components/EmptyState/EmptyState.jsx";
import {
  createCatalogItem,
  createDepartmentBundle,
  deleteCatalogItem,
  deleteDepartmentBundle,
  fetchCatalogItems,
  fetchDepartmentBundles,
  updateCatalogItem,
  updateDepartmentBundle
} from "../onboarding-api.js";
import "../onboarding.css";

const EMPTY_ITEM_FORM = {
  itemKey: "",
  label: "",
  loginUrl: "",
  notes: "",
  isItOnly: false
};

const EMPTY_BUNDLE_FORM = {
  department: "",
  catalogItemKeys: [],
  isActive: true
};

function SvgIcon({ children }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function KeyIcon() {
  return (
    <SvgIcon>
      <path d="M11.5 8.5a2.5 2.5 0 1 0-4.9-.8 2.5 2.5 0 0 0 4.9.8Z" />
      <path d="m11.1 8.1 5.4 5.4" />
      <path d="m14.2 10.5 1.4-1.4" />
      <path d="m15.8 12.1 1.4-1.4" />
    </SvgIcon>
  );
}

function TagIcon() {
  return (
    <SvgIcon>
      <path d="M3.5 10.2V5.8A1.8 1.8 0 0 1 5.3 4h4.4L16 10.3a1 1 0 0 1 0 1.4l-4.3 4.3a1 1 0 0 1-1.4 0L3.9 11.6a2 2 0 0 1-.4-1.4Z" />
      <circle cx="7.4" cy="7.3" r="1" />
    </SvgIcon>
  );
}

function LinkIcon() {
  return (
    <SvgIcon>
      <path d="M7.2 12.8 5.4 14.6a3 3 0 0 1-4.2-4.2L3 8.6" />
      <path d="m12.8 7.2 1.8-1.8a3 3 0 0 1 4.2 4.2L17 11.4" />
      <path d="m6.4 13.6 7.2-7.2" />
    </SvgIcon>
  );
}

function NoteIcon() {
  return (
    <SvgIcon>
      <path d="M5 3.5h10A1.5 1.5 0 0 1 16.5 5v10A1.5 1.5 0 0 1 15 16.5H5A1.5 1.5 0 0 1 3.5 15V5A1.5 1.5 0 0 1 5 3.5Z" />
      <path d="M6.5 7.2h7" />
      <path d="M6.5 10h7" />
      <path d="M6.5 12.8h4.4" />
    </SvgIcon>
  );
}

function ShieldIcon() {
  return (
    <SvgIcon>
      <path d="M10 2.8c1.6 1.2 3.4 1.8 5.5 2v4.1c0 3.6-2.1 5.9-5.5 8.3C6.6 14.8 4.5 12.5 4.5 8.9V4.8c2.1-.2 3.9-.8 5.5-2Z" />
      <path d="m8.3 9.9 1.2 1.2 2.6-2.8" />
    </SvgIcon>
  );
}

function UsersIcon() {
  return (
    <SvgIcon>
      <path d="M7 9.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" />
      <path d="M13.3 8.3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M3.8 15.4a3.6 3.6 0 0 1 6.4-2.2" />
      <path d="M10.5 15.4a3 3 0 0 1 5.2-1.6" />
    </SvgIcon>
  );
}

function GridIcon() {
  return (
    <SvgIcon>
      <rect x="3.8" y="3.8" width="5.2" height="5.2" rx="1" />
      <rect x="11" y="3.8" width="5.2" height="5.2" rx="1" />
      <rect x="3.8" y="11" width="5.2" height="5.2" rx="1" />
      <rect x="11" y="11" width="5.2" height="5.2" rx="1" />
    </SvgIcon>
  );
}

function BoxIcon() {
  return (
    <SvgIcon>
      <path d="m10 2.8 6.2 3.3v7.8L10 17.2l-6.2-3.3V6.1L10 2.8Z" />
      <path d="m3.8 6.1 6.2 3.3 6.2-3.3" />
      <path d="M10 9.4v7.8" />
    </SvgIcon>
  );
}

function LayersIcon() {
  return (
    <SvgIcon>
      <path d="m10 3 6.5 3.6L10 10.2 3.5 6.6 10 3Z" />
      <path d="m3.5 10.1 6.5 3.6 6.5-3.6" />
      <path d="m3.5 13.4 6.5 3.6 6.5-3.6" />
    </SvgIcon>
  );
}

function FieldLabel({ htmlFor, icon, label, helper }) {
  return (
    <label htmlFor={htmlFor} className="catalog-field-label">
      <span className="catalog-field-label-main">
        <span className="catalog-field-icon">{icon}</span>
        <span>{label}</span>
      </span>
      {helper ? <span className="catalog-field-helper">{helper}</span> : null}
    </label>
  );
}

function FieldLegend({ icon, label, helper }) {
  return (
    <div className="catalog-field-label">
      <div className="catalog-field-label-main">
        <span className="catalog-field-icon">{icon}</span>
        <span>{label}</span>
      </div>
      {helper ? <span className="catalog-field-helper">{helper}</span> : null}
    </div>
  );
}

function ToggleField({ id, icon, label, helper, checked, onChange }) {
  return (
    <label className="catalog-switch-field" htmlFor={id}>
      <span className="catalog-switch-copy">
        <span className="catalog-switch-label-row">
          <span className="catalog-field-icon">{icon}</span>
          <span className="catalog-switch-label">{label}</span>
        </span>
        <span className="catalog-switch-helper">{helper}</span>
      </span>
      <span className="catalog-switch-control">
        <input
          id={id}
          className="catalog-switch-input"
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={onChange}
        />
        <span className="catalog-switch-track" aria-hidden="true">
          <span className="catalog-switch-thumb" />
        </span>
      </span>
    </label>
  );
}

function CatalogEmptyState({ icon, title, description }) {
  return (
    <EmptyState
      className="catalog-empty-state"
      icon={<span className="catalog-empty-icon-shell">{icon}</span>}
      title={title}
      description={description}
    />
  );
}

export function CatalogPage() {
  const queryClient = useQueryClient();
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [bundleForm, setBundleForm] = useState(EMPTY_BUNDLE_FORM);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingBundleId, setEditingBundleId] = useState(null);

  const catalogItemsQuery = useQuery({
    queryKey: ["onboarding", "catalog-items"],
    queryFn: fetchCatalogItems
  });

  const bundlesQuery = useQuery({
    queryKey: ["onboarding", "department-bundles"],
    queryFn: fetchDepartmentBundles
  });

  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ["onboarding", "catalog-items"] });
    queryClient.invalidateQueries({ queryKey: ["onboarding", "department-bundles"] });
  };

  const saveCatalogItemMutation = useMutation({
    mutationFn: (payload) =>
      editingItemId ? updateCatalogItem(editingItemId, payload) : createCatalogItem(payload),
    onSuccess: () => {
      invalidateCatalog();
      setItemForm(EMPTY_ITEM_FORM);
      setEditingItemId(null);
    }
  });

  const deleteCatalogItemMutation = useMutation({
    mutationFn: deleteCatalogItem,
    onSuccess: () => invalidateCatalog()
  });

  const saveBundleMutation = useMutation({
    mutationFn: (payload) =>
      editingBundleId ? updateDepartmentBundle(editingBundleId, payload) : createDepartmentBundle(payload),
    onSuccess: () => {
      invalidateCatalog();
      setBundleForm(EMPTY_BUNDLE_FORM);
      setEditingBundleId(null);
    }
  });

  const deleteBundleMutation = useMutation({
    mutationFn: deleteDepartmentBundle,
    onSuccess: () => invalidateCatalog()
  });

  const catalogItems = catalogItemsQuery.data ?? [];
  const bundles = bundlesQuery.data ?? [];
  const activeDepartmentCount = useMemo(
    () => bundles.filter((bundle) => bundle.isActive).length,
    [bundles]
  );

  const handleCatalogSubmit = (event) => {
    event.preventDefault();
    saveCatalogItemMutation.mutate(itemForm);
  };

  const handleBundleSubmit = (event) => {
    event.preventDefault();
    saveBundleMutation.mutate(bundleForm);
  };

  const toggleBundleItem = (itemKey) => {
    setBundleForm((current) => ({
      ...current,
      catalogItemKeys: current.catalogItemKeys.includes(itemKey)
        ? current.catalogItemKeys.filter((value) => value !== itemKey)
        : [...current.catalogItemKeys, itemKey]
    }));
  };

  return (
    <div className="onboarding-panel catalog-page catalog-page-shell">
      <div className="onboarding-split-grid catalog-page-grid">
        <article className="onboarding-card catalog-panel">
          <div className="onboarding-card-header catalog-card-header">
            <div className="catalog-card-heading">
              <div className="catalog-card-title-row">
                <h2>Catalog Items</h2>
                <span className="onboarding-badge catalog-count-badge">{catalogItems.length} apps</span>
              </div>
              <p className="onboarding-card-subtitle">
                Maintain provisioning inputs, login entry points, and IT notes in one tighter catalog workspace.
              </p>
            </div>
          </div>

          <form className="onboarding-form-grid catalog-form-grid" onSubmit={handleCatalogSubmit}>
            <div className="onboarding-form-field">
              <FieldLabel
                htmlFor="catalog-item-key"
                icon={<KeyIcon />}
                label="Item Key"
                helper="Short unique key used in setup sheets and bundle rules."
              />
              <input
                id="catalog-item-key"
                value={itemForm.itemKey}
                onChange={(event) => setItemForm((current) => ({ ...current, itemKey: event.target.value }))}
                placeholder="e.g. sigma"
              />
            </div>

            <div className="onboarding-form-field">
              <FieldLabel
                htmlFor="catalog-label"
                icon={<TagIcon />}
                label="Label"
                helper="Name IT sees when reviewing and editing onboarding access."
              />
              <input
                id="catalog-label"
                value={itemForm.label}
                onChange={(event) => setItemForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="App name shown to IT and onboarding"
              />
            </div>

            <div className="onboarding-form-field is-full">
              <FieldLabel
                htmlFor="catalog-login-url"
                icon={<LinkIcon />}
                label="Login URL"
                helper="Primary destination used when IT hands off access details."
              />
              <input
                id="catalog-login-url"
                value={itemForm.loginUrl}
                onChange={(event) => setItemForm((current) => ({ ...current, loginUrl: event.target.value }))}
                placeholder="https://app.example.com/sign-in"
              />
            </div>

            <div className="onboarding-form-field is-full">
              <FieldLabel
                htmlFor="catalog-notes"
                icon={<NoteIcon />}
                label="Notes"
                helper="Capture setup details, licensing context, or handoff reminders."
              />
              <textarea
                id="catalog-notes"
                value={itemForm.notes}
                onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Add setup or provisioning notes for IT handoff"
              />
            </div>

            <div className="onboarding-form-field is-full">
              <ToggleField
                id="catalog-it-only"
                icon={<ShieldIcon />}
                label="IT-only credential"
                helper="Keep employee-facing onboarding bundles clean when this app is provisioned only by IT."
                checked={itemForm.isItOnly}
                onChange={(event) => setItemForm((current) => ({ ...current, isItOnly: event.target.checked }))}
              />
            </div>

            <div className="onboarding-actions catalog-actions catalog-form-footer">
              <button className="catalog-button catalog-button-primary" type="submit" disabled={saveCatalogItemMutation.isPending}>
                {editingItemId ? "Update Item" : "Add Item"}
              </button>
              {editingItemId ? (
                <button
                  className="catalog-button catalog-button-secondary"
                  type="button"
                  onClick={() => {
                    setEditingItemId(null);
                    setItemForm(EMPTY_ITEM_FORM);
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          {catalogItemsQuery.isLoading ? <p className="onboarding-muted">Loading catalog items…</p> : null}
          {catalogItemsQuery.error ? <p className="onboarding-muted">{catalogItemsQuery.error.message}</p> : null}
          {!catalogItemsQuery.isLoading && !catalogItemsQuery.error && !catalogItems.length ? (
            <CatalogEmptyState
              icon={<BoxIcon />}
              title="No catalog items yet"
              description="Create the application entries IT can provision during onboarding."
            />
          ) : null}

          <div className="onboarding-list catalog-list">
            {catalogItems.map((item) => (
              <div key={item.id} className="onboarding-list-item catalog-list-item">
                <div className="onboarding-list-item-header">
                  <div>
                    <p className="onboarding-list-item-title">{item.label}</p>
                    <p className="onboarding-list-item-meta">
                      <code>{item.itemKey}</code>
                      <span className="catalog-item-separator" aria-hidden="true">•</span>
                      <span>{item.loginUrl || "No login URL added"}</span>
                    </p>
                  </div>
                  <span className={`onboarding-badge catalog-mini-badge${item.isItOnly ? "" : " is-muted"}`}>
                    {item.isItOnly ? "IT only" : "Shared"}
                  </span>
                </div>
                <p className="onboarding-muted catalog-list-notes">{item.notes || "No setup notes yet."}</p>
                <div className="onboarding-actions catalog-actions">
                  <button
                    className="catalog-button catalog-button-secondary"
                    type="button"
                    onClick={() => {
                      setEditingItemId(item.id);
                      setItemForm({
                        itemKey: item.itemKey,
                        label: item.label,
                        loginUrl: item.loginUrl,
                        notes: item.notes ?? "",
                        isItOnly: item.isItOnly
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="catalog-button catalog-button-danger"
                    type="button"
                    onClick={() => deleteCatalogItemMutation.mutate(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="onboarding-card catalog-panel">
          <div className="onboarding-card-header catalog-card-header">
            <div className="catalog-card-heading">
              <div className="catalog-card-title-row">
                <h2>Department Bundles</h2>
                <span className="onboarding-badge catalog-count-badge">{activeDepartmentCount} active bundles</span>
              </div>
              <p className="onboarding-card-subtitle">
                Build lean reusable app sets by department so IT starts from a sensible baseline instead of rebuilding access each time.
              </p>
            </div>
          </div>

          <form className="onboarding-form-grid catalog-form-grid" onSubmit={handleBundleSubmit}>
            <div className="onboarding-form-field">
              <FieldLabel
                htmlFor="bundle-department"
                icon={<UsersIcon />}
                label="Department"
                helper="Team name used to auto-suggest app access during onboarding."
              />
              <input
                id="bundle-department"
                value={bundleForm.department}
                onChange={(event) => setBundleForm((current) => ({ ...current, department: event.target.value }))}
                placeholder="e.g. Marketing"
              />
            </div>

            <div className="onboarding-form-field">
              <ToggleField
                id="bundle-active"
                icon={<LayersIcon />}
                label="Bundle active"
                helper="Inactive bundles stay saved but do not appear as current recommendations."
                checked={bundleForm.isActive}
                onChange={(event) => setBundleForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
            </div>

            <div className="onboarding-form-field is-full">
              <FieldLegend
                icon={<GridIcon />}
                label="Recommended Apps"
                helper="Select apps that should be prechecked when this department is chosen."
              />
              <div className="catalog-selection-shell">
                {catalogItems.length ? (
                  <div className="onboarding-selection-grid catalog-selection-grid">
                    {catalogItems.map((item) => {
                      const selected = bundleForm.catalogItemKeys.includes(item.itemKey);
                      return (
                        <label
                          className={`onboarding-selection-card catalog-selection-option${selected ? " is-selected" : ""}`}
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleBundleItem(item.itemKey)}
                          />
                          <span className="catalog-selection-copy">
                            <span className="catalog-selection-title-row">
                              <span className="catalog-selection-title">{item.label}</span>
                              {item.isItOnly ? (
                                <span className="onboarding-badge catalog-mini-badge is-muted">IT only</span>
                              ) : null}
                            </span>
                            <p>{item.loginUrl || "No login URL added"}</p>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="catalog-selection-empty">Add catalog items first, then bundle them here.</div>
                )}
              </div>
            </div>

            <div className="onboarding-actions catalog-actions catalog-form-footer">
              <button className="catalog-button catalog-button-primary" type="submit" disabled={saveBundleMutation.isPending}>
                {editingBundleId ? "Update Bundle" : "Add Bundle"}
              </button>
              {editingBundleId ? (
                <button
                  className="catalog-button catalog-button-secondary"
                  type="button"
                  onClick={() => {
                    setEditingBundleId(null);
                    setBundleForm(EMPTY_BUNDLE_FORM);
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          {bundlesQuery.isLoading ? <p className="onboarding-muted">Loading department bundles…</p> : null}
          {bundlesQuery.error ? <p className="onboarding-muted">{bundlesQuery.error.message}</p> : null}
          {!bundlesQuery.isLoading && !bundlesQuery.error && !bundles.length ? (
            <CatalogEmptyState
              icon={<LayersIcon />}
              title="No department bundles yet"
              description="Build reusable department access bundles so app selection starts from a clean default."
            />
          ) : null}

          <div className="onboarding-list catalog-list">
            {bundles.map((bundle) => (
              <div key={bundle.id} className="onboarding-list-item catalog-list-item">
                <div className="onboarding-list-item-header">
                  <div>
                    <p className="onboarding-list-item-title">{bundle.department}</p>
                    <p className="onboarding-list-item-meta">
                      {bundle.catalogItemKeys.join(", ") || "No recommended apps"}
                    </p>
                  </div>
                  <span className={`onboarding-badge catalog-mini-badge${bundle.isActive ? "" : " is-muted"}`}>
                    {bundle.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="onboarding-actions catalog-actions">
                  <button
                    className="catalog-button catalog-button-secondary"
                    type="button"
                    onClick={() => {
                      setEditingBundleId(bundle.id);
                      setBundleForm({
                        department: bundle.department,
                        catalogItemKeys: bundle.catalogItemKeys,
                        isActive: bundle.isActive
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="catalog-button catalog-button-danger"
                    type="button"
                    onClick={() => deleteBundleMutation.mutate(bundle.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
