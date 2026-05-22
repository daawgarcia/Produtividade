import { google } from "googleapis";

const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const METADATA_CACHE_TTL_MS = 10 * 60 * 1000;
const ROWS_CACHE_TTL_MS = 60 * 1000;

type SheetMeta = { sheetId: number; title: string };

const metadataCache = new Map<string, { createdAt: number; sheets: SheetMeta[] }>();
const rowsCache = new Map<string, { createdAt: number; rows: string[][] }>();
const inFlightRows = new Map<string, Promise<string[][]>>();

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

async function getSpreadsheetSheets(spreadsheetId: string): Promise<SheetMeta[]> {
  const cached = metadataCache.get(spreadsheetId);
  const now = Date.now();
  if (cached && now - cached.createdAt < METADATA_CACHE_TTL_MS) {
    return cached.sheets;
  }

  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const availableSheets = (metadata.data.sheets ?? [])
    .map((sheet) => ({
      sheetId: Number(sheet.properties?.sheetId ?? -1),
      title: String(sheet.properties?.title ?? ""),
    }))
    .filter((sheet) => sheet.sheetId >= 0 && sheet.title);

  if (!availableSheets.length) {
    throw new Error(`Nenhuma aba encontrada na planilha ${spreadsheetId}`);
  }

  metadataCache.set(spreadsheetId, { createdAt: now, sheets: availableSheets });
  return availableSheets;
}

async function fetchRows(spreadsheetId: string, sheetName: string): Promise<string[][]> {
  const cacheKey = `${spreadsheetId}:${sheetName}`;
  const now = Date.now();
  const cached = rowsCache.get(cacheKey);
  if (cached && now - cached.createdAt < ROWS_CACHE_TTL_MS) {
    return cached.rows;
  }

  const pending = inFlightRows.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:ZZ`,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });

    const rows = (response.data.values ?? []).map((row) =>
      row.map((cell) => String(cell ?? ""))
    );

    rowsCache.set(cacheKey, { createdAt: Date.now(), rows });
    return rows;
  })();

  inFlightRows.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inFlightRows.delete(cacheKey);
  }
}

async function resolveSheetName(
  spreadsheetId: string,
  gid?: number,
  preferredSheetName?: string,
  requirePreferred = false
): Promise<string> {
  const availableSheets = await getSpreadsheetSheets(spreadsheetId);
  if (!availableSheets.length) {
    throw new Error(`Nenhuma aba encontrada na planilha ${spreadsheetId}`);
  }

  if (preferredSheetName) {
    const normalizedPreferred = normalizeText(preferredSheetName);
    const byName = availableSheets.find(
      (sheet) => normalizeText(sheet.title) === normalizedPreferred
    );
    if (byName?.title) {
      return byName.title;
    }

    const byPartialName = availableSheets.find((sheet) => {
      const normalizedTitle = normalizeText(sheet.title);
      return (
        normalizedTitle.includes(normalizedPreferred) ||
        normalizedPreferred.includes(normalizedTitle)
      );
    });
    if (byPartialName?.title) {
      return byPartialName.title;
    }

    if (requirePreferred) {
      throw new Error(
        `Aba "${preferredSheetName}" nao encontrada na planilha ${spreadsheetId}`
      );
    }
  }

  if (typeof gid === "number") {
    const sheetMatch = availableSheets.find(
      (sheet) => sheet.sheetId === gid
    );
    if (sheetMatch?.title) {
      return sheetMatch.title;
    }
  }

  const firstTitle = availableSheets[0]?.title;
  if (!firstTitle) {
    throw new Error(`Nao foi possivel resolver a aba da planilha ${spreadsheetId}`);
  }

  return firstTitle;
}

export async function getSheetRows(spreadsheetId: string, gid?: number): Promise<string[][]> {
  const sheetName = await resolveSheetName(spreadsheetId, gid);
  return fetchRows(spreadsheetId, sheetName);
}

export async function getSheetRowsByName(
  spreadsheetId: string,
  sheetName: string,
  gid?: number,
  requireSheetName = false
): Promise<string[][]> {
  const resolvedName = await resolveSheetName(
    spreadsheetId,
    gid,
    sheetName,
    requireSheetName
  );
  return fetchRows(spreadsheetId, resolvedName);
}
