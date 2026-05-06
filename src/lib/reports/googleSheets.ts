import { google } from "googleapis";

const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

function getSheetsClient() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
    /\\n/g,
    "\n"
  );

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SHEETS_SCOPE,
  });

  return google.sheets({ version: "v4", auth });
}

async function resolveSheetName(
  spreadsheetId: string,
  gid?: number,
  preferredSheetName?: string,
  requirePreferred = false
): Promise<string> {
  const sheets = getSheetsClient();

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const availableSheets = metadata.data.sheets ?? [];
  if (!availableSheets.length) {
    throw new Error(`Nenhuma aba encontrada na planilha ${spreadsheetId}`);
  }

  if (preferredSheetName) {
    const normalizedPreferred = normalizeText(preferredSheetName);
    const byName = availableSheets.find(
      (sheet) =>
        normalizeText(sheet.properties?.title ?? "") === normalizedPreferred
    );
    if (byName?.properties?.title) {
      return byName.properties.title;
    }

    const byPartialName = availableSheets.find((sheet) => {
      const normalizedTitle = normalizeText(sheet.properties?.title ?? "");
      return (
        normalizedTitle.includes(normalizedPreferred) ||
        normalizedPreferred.includes(normalizedTitle)
      );
    });
    if (byPartialName?.properties?.title) {
      return byPartialName.properties.title;
    }

    if (requirePreferred) {
      throw new Error(
        `Aba "${preferredSheetName}" nao encontrada na planilha ${spreadsheetId}`
      );
    }
  }

  if (typeof gid === "number") {
    const sheetMatch = availableSheets.find(
      (sheet) => sheet.properties?.sheetId === gid
    );
    if (sheetMatch?.properties?.title) {
      return sheetMatch.properties.title;
    }
  }

  const firstTitle = availableSheets[0]?.properties?.title;
  if (!firstTitle) {
    throw new Error(`Nao foi possivel resolver a aba da planilha ${spreadsheetId}`);
  }

  return firstTitle;
}

export async function getSheetRows(spreadsheetId: string, gid?: number): Promise<string[][]> {
  const sheets = getSheetsClient();
  const sheetName = await resolveSheetName(spreadsheetId, gid);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:ZZ`,
  });

  const rows = response.data.values ?? [];
  return rows.map((row) => row.map((cell) => String(cell ?? "")));
}

export async function getSheetRowsByName(
  spreadsheetId: string,
  sheetName: string,
  gid?: number,
  requireSheetName = false
): Promise<string[][]> {
  const sheets = getSheetsClient();
  const resolvedName = await resolveSheetName(
    spreadsheetId,
    gid,
    sheetName,
    requireSheetName
  );

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${resolvedName}'!A:ZZ`,
  });

  const rows = response.data.values ?? [];
  return rows.map((row) => row.map((cell) => String(cell ?? "")));
}
