export const spreadsheetExtension = (file) => file?.name?.split('.').pop()?.toLowerCase();
export const isSpreadsheetFile = (file) => ['csv', 'xls', 'xlsx'].includes(spreadsheetExtension(file));

export const normalizeSpreadsheetRow = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), typeof value === 'string' ? value.trim() : value ?? '']));

export async function readSpreadsheetRows(file, onProgress) {
  if (!isSpreadsheetFile(file)) throw new Error('Choose a CSV, XLS, or XLSX file.');
  let buffer = null;
  try {
    onProgress?.({ phase: 'parsing', progress: 5 });
    buffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const rows = workbook.SheetNames.flatMap((name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: false }));
    onProgress?.({ phase: 'validating', progress: 30, total: rows.length });
    return rows;
  } finally { buffer = null; }
}

export async function batchWriteItems({ entries, entity, userId, onProgress, total }) {
  const created = []; const failedRows = [];
  const chunks = Array.from({ length: Math.ceil(entries.length / 400) }, (_, index) => entries.slice(index * 400, index * 400 + 400));
  for (let index = 0; index < chunks.length; index += 1) {
    const batch = chunks[index];
    try { created.push(...await entity.bulkCreate(batch.map(({ item }) => ({ ...item, user_id: userId })))); }
    catch {
      for (const entry of batch) {
        try { created.push(await entity.create({ ...entry.item, user_id: userId })); }
        catch (error) { failedRows.push({ ...entry, reasons: [`Firestore write failed: ${error.message || 'Unknown error'}`] }); }
      }
    }
    onProgress?.({ phase: 'importing', progress: 50 + Math.round(((index + 1) / Math.max(chunks.length, 1)) * 50), total, imported: created.length });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { created, failedRows };
}

// Shared local-only import pipeline used by Flashcards, Formulas, and Questions.
export async function importSpreadsheet({ file, entity, userId, mapRow, validateRow, onProgress, logPrefix = 'Spreadsheet Import' }) {
  const rows = await readSpreadsheetRows(file, onProgress);
  const valid = []; const skippedRows = [];
  rows.forEach((parsedRow, index) => {
    const row = index + 2; const item = mapRow(parsedRow);
    console.info(`[${logPrefix}] Parsed row before validation`, { row, parsedRow, item });
    const reasons = validateRow(item, parsedRow) || [];
    const entry = { row, parsedRow, item };
    if (reasons.length) { const diagnostic = { ...entry, reasons }; skippedRows.push(diagnostic); console.warn(`[${logPrefix}] Skipped row`, diagnostic); }
    else valid.push(entry);
    if (index % 100 === 0) onProgress?.({ phase: 'validating', progress: 30 + Math.round((index / Math.max(rows.length, 1)) * 20), total: rows.length });
  });
  const { created, failedRows } = await batchWriteItems({ entries: valid, entity, userId, onProgress, total: rows.length });
  failedRows.forEach((diagnostic) => console.error(`[${logPrefix}] Failed row`, diagnostic));
  const summary = { total: rows.length, imported: created.length, skipped: skippedRows.length, failed: failedRows.length, skippedRows, failedRows, created };
  console.info(`[${logPrefix}] Import summary`, summary);
  return summary;
}
