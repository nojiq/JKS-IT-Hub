import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import { WorkspaceNavIcon } from "../../../shared/workspace/WorkspaceIcons.jsx";
import { deleteManualIpRecord, updateManualIpRecord } from "../api/ipListApi.js";
import { IpSourceBadge } from "./IpSourceBadge.jsx";
import { ManualIpForm } from "./ManualIpForm.jsx";
import {
  formatDateTime,
  formatHostNumber,
  formatValue,
  getRowDepartment,
  getRowHostname,
  getRowLocation,
  getRowMac,
  getSubnetLabel
} from "../utils/ipListDisplay.js";

export function IpDetailBody({
  row,
  variant = "page",
  onDeleted,
  compactHero = false
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ip-list", "inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["ip-list", "detail", row.ipAddress] })
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateManualIpRecord(id, body),
    onSuccess: async () => {
      setEditing(false);
      setErrorMessage("");
      await invalidate();
    },
    onError: (error) => setErrorMessage(error.message || "Unable to update record.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteManualIpRecord(id),
    onSuccess: async () => {
      await invalidate();
      onDeleted?.();
    },
    onError: (error) => setErrorMessage(error.message || "Unable to delete record.")
  });

  const hostname = getRowHostname(row);
  const location = getRowLocation(row);
  const department = getRowDepartment(row);
  const mac = getRowMac(row);
  const manual = row.manualRecord;
  const asset = row.asset;
  const subnetLabel = getSubnetLabel(row.subnet);
  const allowManualEdit = variant === "page";

  return (
    <>
      <article
        className={`ip-list-hero${compactHero ? " ip-list-hero--compact" : ""}`}
        aria-label="IP overview"
      >
        <div className="ip-list-hero__lead">
          <div className="ip-list-hero__icon" aria-hidden="true">
            <WorkspaceNavIcon icon="ip-list" className="ip-list-hero__icon-svg" />
          </div>
          <div className="ip-list-hero__copy">
            <p className="ip-list-hero__ip">{row.ipAddress}</p>
            {hostname ? <p className="ip-list-hero__name">{hostname}</p> : null}
            <div className="ip-list-hero__chips">
              <IpSourceBadge source={row.source} />
              <span className={`ip-list-purpose-chip${row.subnet ? "" : " is-unmapped"}`}>
                {subnetLabel}
              </span>
              <span className="ip-list-detail-chip">Host {formatHostNumber(row.hostNumber)}</span>
            </div>
          </div>
        </div>
      </article>

      {errorMessage ? (
        <p className="ip-list-feedback is-error" role="alert">{errorMessage}</p>
      ) : null}

      {row.source === "asset" && asset ? (
        <WorkspacePanel
          variant="content"
          title="Asset details"
          meta="Synced from Snipe-IT asset inventory."
          className="ip-list-section-panel"
          actions={(
            <Link className="workspace-inline-button" to={`/assets/${asset.id}`}>
              Open asset
            </Link>
          )}
        >
          <SpecTable
            rows={[
              ["Asset tag", formatValue(asset.assetTag)],
              ["Model", formatValue(asset.modelName)],
              ["Serial", formatValue(asset.serial)],
              ["Category", formatValue(asset.categoryName)],
              ["Status", formatValue(asset.statusLabel)],
              ["Assigned user", formatValue(asset.assignedToUser?.username)],
              ["Snipe assignee", formatValue(asset.snipeAssignedName || asset.snipeAssignedUsername)],
              ["MAC", formatValue(mac)],
              ["Last synced", formatDateTime(asset.lastSyncedAt)]
            ]}
          />
        </WorkspacePanel>
      ) : null}

      {row.source === "manual" && manual ? (
        allowManualEdit && editing ? (
          <WorkspacePanel variant="content" className="ip-list-form-panel" title="Edit manual IP">
            <ManualIpForm
              mode="edit"
              initial={{
                ipAddress: row.ipAddress,
                hostname: manual.hostname ?? "",
                location: manual.location ?? "",
                department: manual.department ?? "",
                macAddress: manual.macAddress ?? "",
                notes: manual.notes ?? ""
              }}
              submitting={updateMutation.isPending}
              errorMessage={errorMessage}
              onSubmit={(body) => {
                const { ipAddress: _ignored, ...rest } = body;
                updateMutation.mutate({ id: manual.id, body: rest });
              }}
              onCancel={() => {
                setEditing(false);
                setErrorMessage("");
              }}
            />
          </WorkspacePanel>
        ) : (
          <WorkspacePanel
            variant="content"
            title="Manual record"
            meta={
              allowManualEdit
                ? "User-curated metadata for this IP."
                : "Open the full page to edit or delete this record."
            }
            className="ip-list-section-panel"
            actions={
              allowManualEdit ? (
                <div className="ip-list-action-row">
                  <button
                    type="button"
                    className="workspace-inline-button"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="workspace-inline-button is-danger"
                    onClick={() => {
                      if (window.confirm(`Delete manual record for ${row.ipAddress}?`)) {
                        deleteMutation.mutate(manual.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <Link
                  className="workspace-inline-button"
                  to={`/ip-list/${encodeURIComponent(row.ipAddress)}`}
                >
                  Edit on full page
                </Link>
              )
            }
          >
            <SpecTable
              rows={[
                ["Hostname / device", formatValue(manual.hostname)],
                ["Location", formatValue(location)],
                ["Department", formatValue(department)],
                ["MAC address", formatValue(mac)],
                ["Notes", formatValue(manual.notes)],
                ["Created", formatDateTime(manual.createdAt)],
                ["Updated", formatDateTime(manual.updatedAt)]
              ]}
            />
          </WorkspacePanel>
        )
      ) : null}

      {row.subnet ? (
        <WorkspacePanel variant="content" title="Subnet" className="ip-list-section-panel">
          <SpecTable
            rows={[
              ["Purpose", formatValue(row.subnet.purpose)],
              ["CIDR", formatValue(row.subnet.cidr)],
              ["Network", formatValue(row.subnet.networkAddress)],
              ["Prefix", `/${row.subnet.prefixLength}`],
              ["Description", formatValue(row.subnet.description)]
            ]}
          />
        </WorkspacePanel>
      ) : null}
    </>
  );
}

function SpecTable({ rows }) {
  return (
    <dl className="ip-list-spec-table">
      {rows.map(([label, value]) => (
        <div className="ip-list-spec-table__row" key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
