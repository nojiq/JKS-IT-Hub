import { Link } from "react-router-dom";
import { IpSourceBadge } from "./IpSourceBadge.jsx";
import {
  formatHostNumber,
  formatValue,
  getRowHostname,
  getRowMac,
  getRowWhere,
  getSubnetLabel,
  getSubnetPurposeLabel
} from "../utils/ipListDisplay.js";

/**
 * Bulk row actions (export, batch tag) deferred — v1 is read-focused inventory.
 */
export function IpInventoryTable({
  rows = [],
  ariaLabel = "IP inventory",
  onRowOpen,
  onRowNavigate,
  onSubnetFilter
}) {
  if (!rows.length) return null;

  const handleRowActivate = (event, row) => {
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      onRowNavigate?.(row);
      return;
    }
    event.preventDefault();
    onRowOpen?.(row);
  };

  return (
    <div className="ip-list-table-wrap">
      <table className="ip-list-table workspace-data-table" aria-label={ariaLabel}>
        <colgroup>
          <col className="ip-list-table__col ip-list-table__col--ip" />
          <col className="ip-list-table__col ip-list-table__col--purpose" />
          <col className="ip-list-table__col ip-list-table__col--host-num" />
          <col className="ip-list-table__col ip-list-table__col--hostname" />
          <col className="ip-list-table__col ip-list-table__col--source" />
          <col className="ip-list-table__col ip-list-table__col--where" />
          <col className="ip-list-table__col ip-list-table__col--mac" />
          <col className="ip-list-table__col ip-list-table__col--action" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">IP address</th>
            <th scope="col">Subnet purpose</th>
            <th scope="col">Host #</th>
            <th scope="col">Hostname / device</th>
            <th scope="col">Source</th>
            <th scope="col">Where</th>
            <th scope="col">MAC</th>
            <th scope="col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.source}-${row.id}-${row.ipAddress}`}
              className="ip-list-table__row"
              onClick={(event) => handleRowActivate(event, row)}
              onAuxClick={(event) => {
                if (event.button === 1) handleRowActivate(event, row);
              }}
            >
              <td className="ip-list-network-cell ip-list-ip-cell">
                <button
                  type="button"
                  className="ip-list-entity-link ip-list-row-ip-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRowActivate(event, row);
                  }}
                >
                  {row.ipAddress}
                </button>
              </td>
              <td>
                <button
                  type="button"
                  className={`ip-list-purpose-chip is-clickable${row.subnet ? "" : " is-unmapped"}`}
                  aria-label={`Filter to ${getSubnetPurposeLabel(row.subnet)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSubnetFilter?.(row);
                  }}
                >
                  {row.subnet ? getSubnetLabel(row.subnet) : "Unmapped"}
                </button>
              </td>
              <td className="ip-list-network-cell">
                <span className="ip-list-host-num">{formatHostNumber(row.hostNumber)}</span>
              </td>
              <td>{formatValue(getRowHostname(row))}</td>
              <td>
                <IpSourceBadge source={row.source} />
              </td>
              <td>{formatValue(getRowWhere(row))}</td>
              <td className="ip-list-network-cell ip-list-mac-cell">
                {formatValue(getRowMac(row))}
              </td>
              <td>
                <Link
                  className="ip-list-detail-link"
                  to={`/ip-list/${encodeURIComponent(row.ipAddress)}`}
                  aria-label={`View ${row.ipAddress}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Full page
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
