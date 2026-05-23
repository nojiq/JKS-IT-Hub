import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const EMPTY_ITEM_FORM = { itemKey: "", label: "", loginUrl: "", notes: "", isItOnly: false };
const EMPTY_BUNDLE_FORM = { department: "", catalogItemKeys: [], isActive: true };

function Icon({ children }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function KeyIcon() {
  return <Icon><path d="M11.5 8.5a2.5 2.5 0 1 0-4.9-.8 2.5 2.5 0 0 0 4.9.8Z" /><path d="m11.1 8.1 5.4 5.4" /><path d="m14.2 10.5 1.4-1.4" /><path d="m15.8 12.1 1.4-1.4" /></Icon>;
}
function TagIcon() {
  return <Icon><path d="M3.5 10.2V5.8A1.8 1.8 0 0 1 5.3 4h4.4L16 10.3a1 1 0 0 1 0 1.4l-4.3 4.3a1 1 0 0 1-1.4 0L3.9 11.6a2 2 0 0 1-.4-1.4Z" /><circle cx="7.4" cy="7.3" r="1" /></Icon>;
}
function LinkIcon() {
  return <Icon><path d="M7.2 12.8 5.4 14.6a3 3 0 0 1-4.2-4.2L3 8.6" /><path d="m12.8 7.2 1.8-1.8a3 3 0 0 1 4.2 4.2L17 11.4" /><path d="m6.4 13.6 7.2-7.2" /></Icon>;
}
function NoteIcon() {
  return <Icon><path d="M5 3.5h10A1.5 1.5 0 0 1 16.5 5v10A1.5 1.5 0 0 1 15 16.5H5A1.5 1.5 0 0 1 3.5 15V5A1.5 1.5 0 0 1 5 3.5Z" /><path d="M6.5 7.2h7" /><path d="M6.5 10h7" /><path d="M6.5 12.8h4.4" /></Icon>;
}
function ShieldIcon() {
  return <Icon><path d="M10 2.8c1.6 1.2 3.4 1.8 5.5 2v4.1c0 3.6-2.1 5.9-5.5 8.3C6.6 14.8 4.5 12.5 4.5 8.9V4.8c2.1-.2 3.9-.8 5.5-2Z" /><path d="m8.3 9.9 1.2 1.2 2.6-2.8" /></Icon>;
}
function UsersIcon() {
  return <Icon><path d="M7 9.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" /><path d="M13.3 8.3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M3.8 15.4a3.6 3.6 0 0 1 6.4-2.2" /><path d="M10.5 15.4a3 3 0 0 1 5.2-1.6" /></Icon>;
}
function GridIcon() {
  return <Icon><rect x="3.8" y="3.8" width="5.2" height="5.2" rx="1" /><rect x="11" y="3.8" width="5.2" height="5.2" rx="1" /><rect x="3.8" y="11" width="5.2" height="5.2" rx="1" /><rect x="11" y="11" width="5.2" height="5.2" rx="1" /></Icon>;
}
function BoxIcon() {
  return <Icon><path d="m10 2.8 6.2 3.3v7.8L10 17.2l-6.2-3.3V6.1L10 2.8Z" /><path d="m3.8 6.1 6.2 3.3 6.2-3.3" /><path d="M10 9.4v7.8" /></Icon>;
}
function LayersIcon() {
  return <Icon><path d="m10 3 6.5 3.6L10 10.2 3.5 6.6 10 3Z" /><path d="m3.5 10.1 6.5 3.6 6.5-3.6" /><path d="m3.5 13.4 6.5 3.6 6.5-3.6" /></Icon>;
}
function PencilIcon() {
  return <Icon><path d="M14.3 3.7a2 2 0 0 1 2.8 2.8L6.5 17.1l-3.8.6.6-3.8L14.3 3.7Z" /></Icon>;
}
function TrashIcon() {
  return <Icon><path d="M4 6h12" /><path d="M8 6V4h4v2" /><path d="M6 6l.9 10.1A1 1 0 0 0 7.9 17h4.2a1 1 0 0 0 1-.9L14 6" /></Icon>;
}
function PlusIcon() {
  return <Icon><path d="M10 4v12M4 10h12" /></Icon>;
}
function CheckIcon() {
  return <Icon><path d="m4 10 4.5 4.5L16 6" /></Icon>;
}
function XIcon() {
  return <Icon><path d="M5 5l10 10M15 5 5 15" /></Icon>;
}

function Toggle({ id, checked, onChange, label }) {
  return (
    <label className="cp-toggle" htmlFor={id} aria-label={label}>
      <input id={id} className="cp-toggle-input" type="checkbox" role="switch" checked={checked} onChange={onChange} />
      <span className="cp-toggle-track" aria-hidden="true"><span className="cp-toggle-thumb" /></span>
    </label>
  );
}

export function CatalogPage() {
  const queryClient = useQueryClient();
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [bundleForm, setBundleForm] = useState(EMPTY_BUNDLE_FORM);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingBundleId, setEditingBundleId] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showBundleForm, setShowBundleForm] = useState(false);

  const catalogItemsQuery = useQuery({ queryKey: ["onboarding", "catalog-items"], queryFn: fetchCatalogItems });
  const bundlesQuery = useQuery({ queryKey: ["onboarding", "department-bundles"], queryFn: fetchDepartmentBundles });

  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ["onboarding", "catalog-items"] });
    queryClient.invalidateQueries({ queryKey: ["onboarding", "department-bundles"] });
  };

  const saveCatalogItemMutation = useMutation({
    mutationFn: (payload) => editingItemId ? updateCatalogItem(editingItemId, payload) : createCatalogItem(payload),
    onSuccess: () => {
      invalidateCatalog();
      setItemForm(EMPTY_ITEM_FORM);
      setEditingItemId(null);
      setShowItemForm(false);
    }
  });

  const deleteCatalogItemMutation = useMutation({
    mutationFn: deleteCatalogItem,
    onSuccess: () => invalidateCatalog()
  });

  const saveBundleMutation = useMutation({
    mutationFn: (payload) => editingBundleId ? updateDepartmentBundle(editingBundleId, payload) : createDepartmentBundle(payload),
    onSuccess: () => {
      invalidateCatalog();
      setBundleForm(EMPTY_BUNDLE_FORM);
      setEditingBundleId(null);
      setShowBundleForm(false);
    }
  });

  const deleteBundleMutation = useMutation({
    mutationFn: deleteDepartmentBundle,
    onSuccess: () => invalidateCatalog()
  });

  const catalogItems = catalogItemsQuery.data ?? [];
  const bundles = bundlesQuery.data ?? [];
  const activeDepartmentCount = useMemo(() => bundles.filter((b) => b.isActive).length, [bundles]);

  const handleCatalogSubmit = (e) => { e.preventDefault(); saveCatalogItemMutation.mutate(itemForm); };
  const handleBundleSubmit = (e) => { e.preventDefault(); saveBundleMutation.mutate(bundleForm); };

  const toggleBundleItem = (itemKey) => {
    setBundleForm((cur) => ({
      ...cur,
      catalogItemKeys: cur.catalogItemKeys.includes(itemKey)
        ? cur.catalogItemKeys.filter((v) => v !== itemKey)
        : [...cur.catalogItemKeys, itemKey]
    }));
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm({ itemKey: item.itemKey, label: item.label, loginUrl: item.loginUrl, notes: item.notes ?? "", isItOnly: item.isItOnly });
    setShowItemForm(true);
  };

  const cancelItemEdit = () => { setEditingItemId(null); setItemForm(EMPTY_ITEM_FORM); setShowItemForm(false); };

  const startEditBundle = (bundle) => {
    setEditingBundleId(bundle.id);
    setBundleForm({ department: bundle.department, catalogItemKeys: bundle.catalogItemKeys, isActive: bundle.isActive });
    setShowBundleForm(true);
  };

  const cancelBundleEdit = () => { setEditingBundleId(null); setBundleForm(EMPTY_BUNDLE_FORM); setShowBundleForm(false); };

  return (
    <div className="cp-shell">

      {/* ── LEFT PANE: Catalog Items ── */}
      <section className="cp-pane">
        <div className="cp-pane-head">
          <div className="cp-pane-head-left">
            <h2 className="cp-pane-title">Catalog Items</h2>
            <span className="cp-count-chip">{catalogItems.length} apps</span>
          </div>
          <button
            className="cp-add-btn"
            type="button"
            onClick={() => { setShowItemForm((v) => !v); setEditingItemId(null); setItemForm(EMPTY_ITEM_FORM); }}
          >
            <span className="cp-add-btn-icon"><PlusIcon /></span>
            New item
          </button>
        </div>
        <p className="cp-pane-sub">Provisioning keys, login URLs, and IT handoff notes in one workspace.</p>

        {showItemForm || editingItemId ? (
          <form className="cp-form" onSubmit={handleCatalogSubmit}>
            <div className="cp-form-head">
              <span className="cp-form-label">{editingItemId ? "Edit item" : "New catalog item"}</span>
            </div>
            <div className="cp-form-row">
              <div className="cp-field">
                <label htmlFor="ci-key" className="cp-field-label">
                  <span className="cp-field-icon"><KeyIcon /></span>Item Key
                </label>
                <input id="ci-key" className="cp-input" value={itemForm.itemKey} onChange={(e) => setItemForm((c) => ({ ...c, itemKey: e.target.value }))} placeholder="e.g. sigma" />
                <span className="cp-field-hint">Unique key used in bundle rules and setup sheets.</span>
              </div>
              <div className="cp-field">
                <label htmlFor="ci-label" className="cp-field-label">
                  <span className="cp-field-icon"><TagIcon /></span>Label
                </label>
                <input id="ci-label" className="cp-input" value={itemForm.label} onChange={(e) => setItemForm((c) => ({ ...c, label: e.target.value }))} placeholder="App name shown to IT" />
                <span className="cp-field-hint">Name IT sees when reviewing onboarding access.</span>
              </div>
            </div>
            <div className="cp-field">
              <label htmlFor="ci-url" className="cp-field-label">
                <span className="cp-field-icon"><LinkIcon /></span>Login URL
              </label>
              <input id="ci-url" className="cp-input" value={itemForm.loginUrl} onChange={(e) => setItemForm((c) => ({ ...c, loginUrl: e.target.value }))} placeholder="https://app.example.com/sign-in" />
              <span className="cp-field-hint">Primary destination for IT access handoff.</span>
            </div>
            <div className="cp-field">
              <label htmlFor="ci-notes" className="cp-field-label">
                <span className="cp-field-icon"><NoteIcon /></span>Notes
              </label>
              <textarea id="ci-notes" className="cp-textarea" value={itemForm.notes} onChange={(e) => setItemForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Setup details, licensing context, handoff reminders…" />
            </div>
            <div className="cp-inline-toggle">
              <span className="cp-inline-toggle-copy">
                <span className="cp-inline-toggle-label"><span className="cp-field-icon"><ShieldIcon /></span>IT-only credential</span>
                <span className="cp-inline-toggle-hint">Hide from employee-facing bundles when IT provisions directly.</span>
              </span>
              <Toggle id="ci-it-only" checked={itemForm.isItOnly} onChange={(e) => setItemForm((c) => ({ ...c, isItOnly: e.target.checked }))} label="IT-only credential" />
            </div>
            <div className="cp-form-actions">
              <button className="cp-btn cp-btn-primary" type="submit" disabled={saveCatalogItemMutation.isPending}>
                <span className="cp-btn-icon"><CheckIcon /></span>
                {editingItemId ? "Update" : "Add item"}
              </button>
              <button className="cp-btn cp-btn-ghost" type="button" onClick={cancelItemEdit}>
                <span className="cp-btn-icon"><XIcon /></span>Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="cp-list-section">
          {catalogItemsQuery.isLoading ? (
            <p className="cp-state-msg">Loading…</p>
          ) : catalogItemsQuery.error ? (
            <p className="cp-state-msg cp-state-error">{catalogItemsQuery.error.message}</p>
          ) : !catalogItems.length ? (
            <div className="cp-empty">
              <span className="cp-empty-icon"><BoxIcon /></span>
              <span className="cp-empty-title">No catalog items yet</span>
              <span className="cp-empty-sub">Add the apps IT provisions during onboarding.</span>
            </div>
          ) : (
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Login URL</th>
                  <th>Type</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {catalogItems.map((item) => (
                  <tr key={item.id} className="cp-table-row">
                    <td><code className="cp-code">{item.itemKey}</code></td>
                    <td className="cp-cell-label">{item.label}</td>
                    <td className="cp-cell-url">{item.loginUrl ? <a href={item.loginUrl} target="_blank" rel="noreferrer" className="cp-url-link">{item.loginUrl}</a> : <span className="cp-cell-empty">—</span>}</td>
                    <td>
                      <span className={`cp-badge${item.isItOnly ? " cp-badge-accent" : " cp-badge-muted"}`}>
                        {item.isItOnly ? "IT only" : "Shared"}
                      </span>
                    </td>
                    <td className="cp-cell-actions">
                      <button className="cp-icon-btn" type="button" onClick={() => startEditItem(item)} title="Edit item">
                        <PencilIcon />
                      </button>
                      <button className="cp-icon-btn cp-icon-btn-danger" type="button" onClick={() => deleteCatalogItemMutation.mutate(item.id)} title="Delete item">
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="cp-divider" role="separator" />

      {/* ── RIGHT PANE: Department Bundles ── */}
      <section className="cp-pane">
        <div className="cp-pane-head">
          <div className="cp-pane-head-left">
            <h2 className="cp-pane-title">Department Bundles</h2>
            <span className="cp-count-chip">{activeDepartmentCount} active</span>
          </div>
          <button
            className="cp-add-btn"
            type="button"
            onClick={() => { setShowBundleForm((v) => !v); setEditingBundleId(null); setBundleForm(EMPTY_BUNDLE_FORM); }}
          >
            <span className="cp-add-btn-icon"><PlusIcon /></span>
            New bundle
          </button>
        </div>
        <p className="cp-pane-sub">Reusable app sets per department — IT starts from a sensible baseline every time.</p>

        {showBundleForm || editingBundleId ? (
          <form className="cp-form" onSubmit={handleBundleSubmit}>
            <div className="cp-form-head">
              <span className="cp-form-label">{editingBundleId ? "Edit bundle" : "New bundle"}</span>
            </div>
            <div className="cp-form-row">
              <div className="cp-field">
                <label htmlFor="bd-dept" className="cp-field-label">
                  <span className="cp-field-icon"><UsersIcon /></span>Department
                </label>
                <input id="bd-dept" className="cp-input" value={bundleForm.department} onChange={(e) => setBundleForm((c) => ({ ...c, department: e.target.value }))} placeholder="e.g. Marketing" />
                <span className="cp-field-hint">Auto-suggests apps when this team is selected.</span>
              </div>
              <div className="cp-inline-toggle cp-inline-toggle-field">
                <span className="cp-inline-toggle-copy">
                  <span className="cp-inline-toggle-label"><span className="cp-field-icon"><LayersIcon /></span>Bundle active</span>
                  <span className="cp-inline-toggle-hint">Inactive bundles are saved but won&apos;t appear as recommendations.</span>
                </span>
                <Toggle id="bd-active" checked={bundleForm.isActive} onChange={(e) => setBundleForm((c) => ({ ...c, isActive: e.target.checked }))} label="Bundle active" />
              </div>
            </div>

            <div className="cp-field">
              <div className="cp-field-label cp-field-label-legend">
                <span className="cp-field-icon"><GridIcon /></span>Recommended Apps
              </div>
              <span className="cp-field-hint" style={{ marginBottom: "0.55rem", display: "block" }}>Prechecked when this department is selected during onboarding.</span>
              {catalogItems.length ? (
                <div className="cp-app-checklist">
                  {catalogItems.map((item) => {
                    const selected = bundleForm.catalogItemKeys.includes(item.itemKey);
                    return (
                      <label key={item.id} className={`cp-app-option${selected ? " is-checked" : ""}`}>
                        <input type="checkbox" className="cp-app-checkbox" checked={selected} onChange={() => toggleBundleItem(item.itemKey)} />
                        <span className="cp-app-option-body">
                          <span className="cp-app-option-name">{item.label}</span>
                          {item.isItOnly ? <span className="cp-badge cp-badge-muted" style={{ fontSize: "0.68rem" }}>IT only</span> : null}
                        </span>
                        <code className="cp-code cp-app-option-key">{item.itemKey}</code>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="cp-app-checklist-empty">Add catalog items first, then bundle them here.</div>
              )}
            </div>

            <div className="cp-form-actions">
              <button className="cp-btn cp-btn-primary" type="submit" disabled={saveBundleMutation.isPending}>
                <span className="cp-btn-icon"><CheckIcon /></span>
                {editingBundleId ? "Update" : "Add bundle"}
              </button>
              <button className="cp-btn cp-btn-ghost" type="button" onClick={cancelBundleEdit}>
                <span className="cp-btn-icon"><XIcon /></span>Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="cp-list-section">
          {bundlesQuery.isLoading ? (
            <p className="cp-state-msg">Loading…</p>
          ) : bundlesQuery.error ? (
            <p className="cp-state-msg cp-state-error">{bundlesQuery.error.message}</p>
          ) : !bundles.length ? (
            <div className="cp-empty">
              <span className="cp-empty-icon"><LayersIcon /></span>
              <span className="cp-empty-title">No bundles yet</span>
              <span className="cp-empty-sub">Build department access defaults to save time at onboarding.</span>
            </div>
          ) : (
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Apps</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => (
                  <tr key={bundle.id} className="cp-table-row">
                    <td className="cp-cell-label">{bundle.department}</td>
                    <td className="cp-cell-apps">
                      {bundle.catalogItemKeys.length ? (
                        <span className="cp-app-tags">
                          {bundle.catalogItemKeys.map((k) => <code key={k} className="cp-code">{k}</code>)}
                        </span>
                      ) : (
                        <span className="cp-cell-empty">No apps</span>
                      )}
                    </td>
                    <td>
                      <span className={`cp-badge${bundle.isActive ? " cp-badge-accent" : " cp-badge-muted"}`}>
                        {bundle.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="cp-cell-actions">
                      <button className="cp-icon-btn" type="button" onClick={() => startEditBundle(bundle)} title="Edit bundle">
                        <PencilIcon />
                      </button>
                      <button className="cp-icon-btn cp-icon-btn-danger" type="button" onClick={() => deleteBundleMutation.mutate(bundle.id)} title="Delete bundle">
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
