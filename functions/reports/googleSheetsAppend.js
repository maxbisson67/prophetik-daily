import { google } from "googleapis";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function parseServiceAccountJson(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function getSheetsClient(serviceAccountJson) {
  const credentials = parseServiceAccountJson(serviceAccountJson);
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error("GROUP_REPORT_SHEETS_SA_JSON invalid or missing client_email/private_key");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [SHEETS_SCOPE],
  });

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

export async function appendRowsToSheet({
  serviceAccountJson,
  spreadsheetId,
  range,
  rows,
}) {
  if (!spreadsheetId) {
    throw new Error("GROUP_REPORT_SHEET_ID is required");
  }
  if (!Array.isArray(rows) || !rows.length) {
    return { updatedRows: 0 };
  }

  const sheets = await getSheetsClient(serviceAccountJson);
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: range || "Daily!A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });

  return {
    updatedRows: res.data.updates?.updatedRows ?? rows.length,
    tableRange: res.data.updates?.updatedRange || null,
  };
}

export async function ensureSheetHeader({
  serviceAccountJson,
  spreadsheetId,
  sheetName,
  headerRow,
}) {
  const sheets = await getSheetsClient(serviceAccountJson);
  const readRange = `${sheetName}!A1:A1`;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: readRange,
  });

  const firstCell = existing.data.values?.[0]?.[0];
  if (firstCell) return { created: false };

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headerRow] },
  });

  return { created: true };
}
