export async function exportCredentials(userId) {
  const response = await fetch(`/api/v1/users/${userId}/credentials/export`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'text/plain'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to export credentials');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  a.href = url;
  a.download = `credentials-${userId}-${timestamp}.txt`;
  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  return success;
}
