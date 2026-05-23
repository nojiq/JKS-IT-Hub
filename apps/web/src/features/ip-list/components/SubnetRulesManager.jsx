import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSubnetRule,
  deleteSubnetRule,
  fetchSubnetRules,
  updateSubnetRule
} from "../api/ipListApi.js";

const EMPTY = { cidr: "", purpose: "", description: "" };

export function SubnetRulesManager({ onClose }) {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({
    queryKey: ["ip-list", "subnets"],
    queryFn: fetchSubnetRules
  });

  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ip-list", "subnets"] }),
      queryClient.invalidateQueries({ queryKey: ["ip-list", "inventory"] })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (body) => createSubnetRule(body),
    onSuccess: async () => {
      setDraft(EMPTY);
      setErrorMessage("");
      await invalidate();
    },
    onError: (error) => setErrorMessage(error.message || "Unable to create subnet rule.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateSubnetRule(id, body),
    onSuccess: async () => {
      setEditingId(null);
      setDraft(EMPTY);
      setErrorMessage("");
      await invalidate();
    },
    onError: (error) => setErrorMessage(error.message || "Unable to update subnet rule.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSubnetRule(id),
    onSuccess: invalidate,
    onError: (error) => setErrorMessage(error.message || "Unable to delete subnet rule.")
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      cidr: draft.cidr.trim(),
      purpose: draft.purpose.trim(),
      description: draft.description.trim() === "" ? null : draft.description.trim()
    };
    if (!payload.cidr || !payload.purpose) {
      setErrorMessage("CIDR and purpose are required.");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setDraft({
      cidr: rule.cidr,
      purpose: rule.purpose,
      description: rule.description ?? ""
    });
    setErrorMessage("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY);
    setErrorMessage("");
  };

  const rules = rulesQuery.data ?? [];
  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <section className="ip-list-subnet-manager" aria-label="Subnet rules">
      <header className="ip-list-subnet-manager__header">
        <div>
          <h3 className="ip-list-subnet-manager__title">Subnet rules</h3>
          <p className="ip-list-subnet-manager__description">
            Editable subnet ranges drive purpose grouping. CIDR like <code>192.168.78.0/24</code>.
          </p>
        </div>
        {onClose ? (
          <button type="button" className="workspace-inline-button" onClick={onClose}>
            Close
          </button>
        ) : null}
      </header>

      <form className="ip-list-subnet-form" onSubmit={handleSubmit}>
        <label className="ip-list-form__field">
          <span className="ip-list-form__label">CIDR / range</span>
          <input
            className="ip-list-form__input"
            value={draft.cidr}
            onChange={(event) => setDraft((prev) => ({ ...prev, cidr: event.target.value }))}
            placeholder="192.168.78.0/24"
            maxLength={50}
            required
          />
        </label>
        <label className="ip-list-form__field">
          <span className="ip-list-form__label">Purpose</span>
          <input
            className="ip-list-form__input"
            value={draft.purpose}
            onChange={(event) => setDraft((prev) => ({ ...prev, purpose: event.target.value }))}
            placeholder="Server / Printer / Wi-Fi"
            maxLength={191}
            required
          />
        </label>
        <label className="ip-list-form__field is-full">
          <span className="ip-list-form__label">Description</span>
          <textarea
            className="ip-list-form__input ip-list-form__textarea"
            value={draft.description}
            onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
            rows={2}
            maxLength={2000}
          />
        </label>
        {errorMessage ? (
          <p className="ip-list-feedback is-error" role="alert">{errorMessage}</p>
        ) : null}
        <div className="ip-list-form__actions">
          {editingId ? (
            <button type="button" className="workspace-inline-button" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="workspace-inline-button is-primary" disabled={submitting}>
            {submitting
              ? "Saving…"
              : editingId
                ? "Save subnet"
                : "Add subnet"}
          </button>
        </div>
      </form>

      <div className="ip-list-subnet-list" aria-busy={rulesQuery.isLoading}>
        {rulesQuery.isLoading ? <p className="ip-list-muted">Loading rules…</p> : null}
        {!rulesQuery.isLoading && !rules.length ? (
          <p className="ip-list-muted">No subnet rules yet. Add one to start grouping IPs.</p>
        ) : null}
        <ul className="ip-list-subnet-rule-list">
          {rules.map((rule) => (
            <li key={rule.id} className="ip-list-subnet-rule">
              <div className="ip-list-subnet-rule__copy">
                <p className="ip-list-subnet-rule__purpose">{rule.purpose}</p>
                <p className="ip-list-subnet-rule__cidr"><code>{rule.cidr}</code></p>
                {rule.description ? (
                  <p className="ip-list-subnet-rule__description">{rule.description}</p>
                ) : null}
              </div>
              <div className="ip-list-subnet-rule__actions">
                <button
                  type="button"
                  className="workspace-inline-button"
                  onClick={() => startEdit(rule)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="workspace-inline-button is-danger"
                  onClick={() => {
                    if (window.confirm(`Delete subnet rule ${rule.cidr}?`)) {
                      deleteMutation.mutate(rule.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
