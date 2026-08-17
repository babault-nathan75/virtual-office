function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(';'),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(';') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(';')
    ),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Le titre du document HTML sert de nom de fichier proposé par le navigateur
// dans « Enregistrer au format PDF » : c'est là que le paramètre filename
// s'applique, alors qu'il était jusqu'ici reçu puis ignoré.
export function exportToPDF(title: string, data: Record<string, unknown>[], filename: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(filename)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; color: #0f172a; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .date { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:hover td { background: #f8fafc; }
    .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="date">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <table>
    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${data.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <p class="footer">SecrétariatPro — Rapport automatique</p>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}
