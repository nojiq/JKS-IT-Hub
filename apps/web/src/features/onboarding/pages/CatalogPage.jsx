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
  const loading = catalogItemsQuery.isLoading || bundlesQuery.isLoading;
  const error = catalogItemsQuery.error || bundlesQuery.error;
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
    <div className="onboarding-panel">
      <div className="onboarding-split-grid">
        <article className="onboarding-card">
          <div className="onboarding-card-header">
            <div>
              <h2>Catalog Items</h2>
              <p className="onboarding-card-subtitle">
                Manage the apps, login URLs, and notes that appear in onboarding setup sheets.
              </p>
            </div>
            <span className="onboarding-badge">{catalogItems.length} apps</span>
          </div>

          <form className="onboarding-form-grid" onSubmit={handleCatalogSubmit}>
            <div className="onboarding-form-field">
              <label htmlFor="catalog-item-key">Item Key</label>
              <input
                id="catalog-item-key"
                value={itemForm.itemKey}
                onChange={(event) => setItemForm((current) => ({ ...current, itemKey: event.target.value }))}
                placeholder="sigma"
              />
            </div>

            <div className="onboarding-form-field">
              <label htmlFor="catalog-label">Label</label>
              <input
                id="catalog-label"
                value={itemForm.label}
                onChange={(event) => setItemForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Sigma"
              />
            </div>

            <div className="onboarding-form-field is-full">
              <label htmlFor="catalog-login-url">Login URL</label>
              <input
                id="catalog-login-url"
                value={itemForm.loginUrl}
                onChange={(event) => setItemForm((current) => ({ ...current, loginUrl: event.target.value }))}
                placeholder="https://sigma.example"
              />
            </div>

            <div className="onboarding-form-field is-full">
              <label htmlFor="catalog-notes">Notes</label>
              <textarea
                id="catalog-notes"
                value={itemForm.notes}
                onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Shown in the setup sheet for IT handoff."
              />
            </div>

            <div className="onboarding-form-field">
              <label className="onboarding-mode-option">
                <input
                  type="checkbox"
                  checked={itemForm.isItOnly}
                  onChange={(event) => setItemForm((current) => ({ ...current, isItOnly: event.target.checked }))}
                />
                IT-only credential
              </label>
            </div>

            <div className="onboarding-actions">
              <button className="onboarding-button" type="submit" disabled={saveCatalogItemMutation.isPending}>
                {editingItemId ? "Update Item" : "Add Item"}
              </button>
              {editingItemId ? (
                <button
                  className="onboarding-button-secondary"
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

          {loading ? <p className="onboarding-muted">Loading catalog items…</p> : null}
          {error ? <p className="onboarding-muted">{error.message}</p> : null}
          {!loading && !catalogItems.length ? (
            <div className="onboarding-empty">No catalog items yet. Add the apps IT provisions for new joiners.</div>
          ) : null}

          <div className="onboarding-list">
            {catalogItems.map((item) => (
              <div key={item.id} className="onboarding-list-item">
                <div className="onboarding-list-item-header">
                  <div>
                    <p className="onboarding-list-item-title">{item.label}</p>
                    <p className="onboarding-list-item-meta">
                      `{item.itemKey}` • {item.loginUrl}
                    </p>
                  </div>
                  <span className={`onboarding-badge${item.isItOnly ? "" : " is-muted"}`}>
                    {item.isItOnly ? "IT only" : "Shared"}
                  </span>
                </div>
                <p className="onboarding-muted">{item.notes || "No setup notes yet."}</p>
                <div className="onboarding-actions">
                  <button
                    className="onboarding-button-secondary"
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
                    className="onboarding-button-danger"
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

        <article className="onboarding-card">
          <div className="onboarding-card-header">
            <div>
              <h2>Department Bundles</h2>
              <p className="onboarding-card-subtitle">
                Preselect recommended apps by department so IT does not rebuild the list for every joiner.
              </p>
            </div>
            <span className="onboarding-badge">{activeDepartmentCount} active bundles</span>
          </div>

          <form className="onboarding-form-grid" onSubmit={handleBundleSubmit}>
            <div className="onboarding-form-field">
              <label htmlFor="bundle-department">Department</label>
              <input
                id="bundle-department"
                value={bundleForm.department}
                onChange={(event) => setBundleForm((current) => ({ ...current, department: event.target.value }))}
                placeholder="Marketing"
              />
            </div>

            <div className="onboarding-form-field">
              <label className="onboarding-mode-option">
                <input
                  type="checkbox"
                  checked={bundleForm.isActive}
                  onChange={(event) => setBundleForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Bundle active
              </label>
            </div>

            <div className="onboarding-form-field is-full">
              <label>Recommended Apps</label>
              <div className="onboarding-selection-grid">
                {catalogItems.map((item) => (
                  <div className="onboarding-selection-card" key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={bundleForm.catalogItemKeys.includes(item.itemKey)}
                        onChange={() => toggleBundleItem(item.itemKey)}
                      />
                      {item.label}
                    </label>
                    <p>{item.loginUrl}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="onboarding-actions">
              <button className="onboarding-button" type="submit" disabled={saveBundleMutation.isPending}>
                {editingBundleId ? "Update Bundle" : "Add Bundle"}
              </button>
              {editingBundleId ? (
                <button
                  className="onboarding-button-secondary"
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

          {!loading && !bundles.length ? (
            <div className="onboarding-empty">No department bundles yet. Add one to auto-select apps for a team.</div>
          ) : null}

          <div className="onboarding-list">
            {bundles.map((bundle) => (
              <div key={bundle.id} className="onboarding-list-item">
                <div className="onboarding-list-item-header">
                  <div>
                    <p className="onboarding-list-item-title">{bundle.department}</p>
                    <p className="onboarding-list-item-meta">
                      {bundle.catalogItemKeys.join(", ") || "No recommended apps"}
                    </p>
                  </div>
                  <span className={`onboarding-badge${bundle.isActive ? "" : " is-muted"}`}>
                    {bundle.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="onboarding-actions">
                  <button
                    className="onboarding-button-secondary"
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
                    className="onboarding-button-danger"
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
