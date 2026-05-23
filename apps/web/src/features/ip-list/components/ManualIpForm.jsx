import { useEffect, useState } from "react";
import { useIpAvailability } from "../hooks/useIpAvailability.js";
import {
  getExistingIpLabel,
  ipAddressPattern,
  isValidIpv4,
  normalizeIpAddressInput,
  normalizeMacAddressInput,
  normalizeManualTextInput
} from "../utils/ipListDisplay.js";

const EMPTY = {
  ipAddress: "",
  hostname: "",
  location: "",
  department: "",
  macAddress: "",
  notes: ""
};

const buildInitial = (initial) => ({
  ...EMPTY,
  ...Object.fromEntries(
    Object.entries(initial ?? {}).filter(([, value]) => value !== undefined && value !== null)
  )
});

const normalizeChangeValue = (key, value) => {
  if (key === "ipAddress") return normalizeIpAddressInput(value, { compact: false });
  if (key === "macAddress") return normalizeMacAddressInput(value);
  return value;
};

const normalizeSubmitValue = (key, value) => {
  if (key === "ipAddress") return normalizeIpAddressInput(value);
  if (key === "macAddress") return normalizeMacAddressInput(value);
  if (["hostname", "location", "department"].includes(key)) return normalizeManualTextInput(value);
  return String(value ?? "").trim();
};

export function ManualIpForm({
  mode = "create",
  initial = null,
  submitting = false,
  errorMessage = "",
  duplicateError = null,
  onSubmit,
  onCancel,
  onNavigateDuplicate
}) {
  const [values, setValues] = useState(() => buildInitial(initial));

  useEffect(() => {
    setValues(buildInitial(initial));
  }, [initial]);

  const probeEnabled = mode === "create" && !duplicateError;
  const availability = useIpAvailability(values.ipAddress, { enabled: probeEnabled });
  const ipTaken = availability.status === "taken";
  const ipAvailable = availability.status === "available";

  const update = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: normalizeChangeValue(key, event.target.value) }));
  };

  const normalizeField = (key) => () => {
    setValues((prev) => ({ ...prev, [key]: normalizeSubmitValue(key, prev[key]) }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || ipTaken) return;
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) => {
        const normalized = normalizeSubmitValue(key, value);
        return [key, normalized === "" ? null : normalized];
      })
    );
    if (mode === "create") payload.ipAddress = normalizeIpAddressInput(values.ipAddress);
    onSubmit?.(payload);
  };

  const lockIp = mode === "edit";
  const submitDisabled = submitting || (mode === "create" && (ipTaken || availability.isChecking));

  const handleOpenExisting = () => {
    const ip = availability.record?.ipAddress ?? duplicateError?.existing?.ipAddress;
    if (!ip) return;
    onNavigateDuplicate?.({
      redirectTo: `/ip-list/${encodeURIComponent(ip)}`,
      existing: availability.record ?? duplicateError?.existing
    });
  };

  return (
    <form className="ip-list-form" onSubmit={handleSubmit} aria-labelledby="ip-list-form-title">
      <header className="ip-list-form__header">
        <h3 className="ip-list-form__title" id="ip-list-form-title">
          {mode === "edit" ? "Edit manual IP" : "Add manual IP"}
        </h3>
        <p className="ip-list-form__description">
          {mode === "edit"
            ? "Update host metadata for this manual record."
            : "Record a known IP not synced via asset inventory."}
        </p>
      </header>

      {duplicateError ? (
        <div className="ip-list-feedback is-error" role="alert">
          <p>IP address already exists.</p>
          {duplicateError.existing ? (
            <p>
              Existing: <strong>{duplicateError.existing.label ?? duplicateError.existing.ipAddress}</strong>
            </p>
          ) : null}
          {duplicateError.redirectTo || duplicateError.existing?.ipAddress ? (
            <button
              type="button"
              className="workspace-inline-button is-primary"
              onClick={() => onNavigateDuplicate?.(duplicateError)}
            >
              Open existing record
            </button>
          ) : null}
        </div>
      ) : null}

      {!duplicateError && errorMessage ? (
        <p className="ip-list-feedback is-error" role="alert">{errorMessage}</p>
      ) : null}

      <div className="ip-list-form__grid">
        <Field label="IP address" required full>
          <input
            className="ip-list-form__input"
            value={values.ipAddress}
            onChange={update("ipAddress")}
            onBlur={normalizeField("ipAddress")}
            placeholder="192.168.78.15"
            pattern={ipAddressPattern}
            required
            readOnly={lockIp}
            aria-readonly={lockIp ? "true" : undefined}
            aria-describedby={mode === "create" ? "ip-availability-hint" : undefined}
          />
          {mode === "create" && isValidIpv4(values.ipAddress) ? (
            <div className="ip-list-ip-hint" id="ip-availability-hint">
              {availability.isChecking ? (
                <span className="ip-list-ip-hint__checking">Checking availability…</span>
              ) : ipAvailable ? (
                <span className="ip-list-ip-hint__available">Available</span>
              ) : ipTaken ? (
                <span className="ip-list-ip-hint__taken">
                  Already used by{" "}
                  <button type="button" className="ip-list-ip-hint__link" onClick={handleOpenExisting}>
                    {getExistingIpLabel(availability.record) ?? values.ipAddress}
                  </button>
                  {" — open existing"}
                </span>
              ) : null}
            </div>
          ) : null}
        </Field>

        <Field label="Hostname / device">
          <input
            className="ip-list-form__input"
            value={values.hostname}
            onChange={update("hostname")}
            onBlur={normalizeField("hostname")}
            placeholder="printer-finance"
            maxLength={255}
          />
        </Field>

        <Field label="Location">
          <input
            className="ip-list-form__input"
            value={values.location}
            onChange={update("location")}
            onBlur={normalizeField("location")}
            placeholder="HQ · Level 3"
            maxLength={191}
          />
        </Field>

        <Field label="Department">
          <input
            className="ip-list-form__input"
            value={values.department}
            onChange={update("department")}
            onBlur={normalizeField("department")}
            placeholder="Finance"
            maxLength={191}
          />
        </Field>

        <Field label="MAC address">
          <input
            className="ip-list-form__input"
            value={values.macAddress}
            onChange={update("macAddress")}
            onBlur={normalizeField("macAddress")}
            placeholder="AA:BB:CC:DD:EE:FF"
            maxLength={50}
          />
        </Field>

        <Field label="Notes" full>
          <textarea
            className="ip-list-form__input ip-list-form__textarea"
            value={values.notes}
            onChange={update("notes")}
            rows={3}
            maxLength={2000}
            placeholder="Context, owner, vendor, etc."
          />
        </Field>
      </div>

      <footer className="ip-list-form__actions">
        <button
          type="button"
          className="workspace-inline-button"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="workspace-inline-button is-primary" disabled={submitDisabled}>
          {submitting ? "Saving…" : mode === "edit" ? "Save changes" : "Create record"}
        </button>
      </footer>
    </form>
  );
}

function Field({ label, required, full, children }) {
  return (
    <label className={`ip-list-form__field${full ? " is-full" : ""}`}>
      <span className="ip-list-form__label">
        {label}
        {required ? <span className="ip-list-form__required" aria-hidden="true">*</span> : null}
      </span>
      {children}
    </label>
  );
}
