import { apiFetch } from "../../../shared/utils/api-client.js";

export async function exportCredentials(userId, format = 'standard') {
  const response = await apiFetch(`/api/v1/users/${userId}/credentials/export?format=${format}`, {
    method: 'GET',
    headers: {
      'Accept': 'text/plain'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to export credentials');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const extension = format === 'compressed' ? 'csv' : 'txt';
  a.href = url;
  a.download = `credentials-${userId}-${timestamp}.${extension}`;
  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  return 'success';
}

function parseBatchSummary(content, format) {
  if (typeof content !== 'string' || !content.trim()) {
    return { totalUsers: 0, successfulExports: 0, skippedUsers: 0, batchId: null };
  }

  if (format === 'compressed') {
    const [headerLine] = content.split('\n');
    const parts = headerLine?.split('|') ?? [];
    if (parts[0] === 'IT-HUB' && parts[1] === 'EXPORT' && parts[2] === 'BATCH') {
      return {
        batchId: parts[4] || null,
        totalUsers: Number(parts[5] || 0),
        successfulExports: Number(parts[6] || 0),
        skippedUsers: Number(parts[7] || 0)
      };
    }
  }

  const getNumber = (label) => {
    const match = content.match(new RegExp(`^${label}:\\s*(\\d+)`, 'm'));
    return Number(match?.[1] || 0);
  };
  const batchIdMatch = content.match(/^Batch ID:\s*(.+)$/m);

  return {
    batchId: batchIdMatch?.[1]?.trim() || null,
    totalUsers: getNumber('Total Users'),
    successfulExports: getNumber('Successful Exports'),
    skippedUsers: getNumber('Skipped Users')
  };
}

export async function exportBatchCredentials(userIds, format = 'standard') {
  const response = await apiFetch('/api/v1/credentials/export/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/plain'
    },
    body: JSON.stringify({ userIds, format })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to export batch credentials');
  }

  const rawContent = await response.text();
  const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';
  const blob = new Blob([rawContent], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  // Get filename from header or generate
  const disposition = response.headers.get('content-disposition');
  const extension = format === 'compressed' ? 'csv' : 'txt';
  let filename = `batch-credentials-${new Date().toISOString().split('T')[0]}.${extension}`;

  if (disposition && disposition.indexOf('attachment') !== -1) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, '');
    }
  }

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  const summary = parseBatchSummary(rawContent, format);
  return { ...summary, filename };
}
