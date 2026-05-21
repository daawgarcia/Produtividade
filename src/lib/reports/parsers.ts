// Debug Inspector Version: 2026-05-21 18:37:38
import type {
  MoverReportItem,
  MoversReport,
  OperatorDuplicateItem,
  OperatorMetricKey,
  OperatorReportItem,
  OperatorsReport,
} from "@/lib/reports/types";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseNumber(value: string): number {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DEDUP_START_DATE = "2026-05-22";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const UI_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatTimestampForUi(timestamp: number): string {
  return UI_DATE_TIME_FORMATTER.format(new Date(timestamp));
}

function parseExcelSerialToLocalDate(serial: number): Date {
  const excelEpochLocal = new Date(1899, 11, 30, 0, 0, 0, 0);
  return new Date(excelEpochLocal.getTime() + Math.round(serial * 86400 * 1000));
}

function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dateWithSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateWithSlash) {
    const day = dateWithSlash[1].padStart(2, "0");
    const month = dateWithSlash[2].padStart(2, "0");
    const year = dateWithSlash[3].length === 2 ? `20${dateWithSlash[3]}` : dateWithSlash[3];
    return `${year}-${month}-${day}`;
  }

  const dateWithDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (dateWithDash) {
    const day = dateWithDash[1].padStart(2, "0");
    const month = dateWithDash[2].padStart(2, "0");
    const year = dateWithDash[3].length === 2 ? `20${dateWithDash[3]}` : dateWithDash[3];
    return `${year}-${month}-${day}`;
  }

  const maybeNumber = Number(trimmed);
  if (Number.isFinite(maybeNumber) && maybeNumber > 20000) {
    const date = parseExcelSerialToLocalDate(maybeNumber);
    if (!Number.isNaN(date.getTime())) {
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function toTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoDateTime = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (isoDateTime) {
    const year = Number(isoDateTime[1]);
    const month = Number(isoDateTime[2]);
    const day = Number(isoDateTime[3]);
    const hour = Number(isoDateTime[4] ?? "0");
    const minute = Number(isoDateTime[5] ?? "0");
    const second = Number(isoDateTime[6] ?? "0");
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct.getTime();
  }

  const slashDateTime = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (slashDateTime) {
    const day = slashDateTime[1].padStart(2, "0");
    const month = slashDateTime[2].padStart(2, "0");
    const year =
      slashDateTime[3].length === 2 ? `20${slashDateTime[3]}` : slashDateTime[3];
    const hour = Number((slashDateTime[4] ?? "0").padStart(2, "0"));
    const minute = Number((slashDateTime[5] ?? "0").padStart(2, "0"));
    const second = Number((slashDateTime[6] ?? "0").padStart(2, "0"));
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  const dashDateTime = trimmed.match(
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (dashDateTime) {
    const day = dashDateTime[1].padStart(2, "0");
    const month = dashDateTime[2].padStart(2, "0");
    const year =
      dashDateTime[3].length === 2 ? `20${dashDateTime[3]}` : dashDateTime[3];
    const hour = Number((dashDateTime[4] ?? "0").padStart(2, "0"));
    const minute = Number((dashDateTime[5] ?? "0").padStart(2, "0"));
    const second = Number((dashDateTime[6] ?? "0").padStart(2, "0"));
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  const maybeNumber = Number(trimmed);
  if (Number.isFinite(maybeNumber) && maybeNumber > 20000) {
    const parsed = parseExcelSerialToLocalDate(maybeNumber);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return null;
}

function isStrictDateLikeText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return true;
  }

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(trimmed)) {
    return true;
  }

  return false;
}

function findDateColumn(headers: string[], dataRows: string[][]): number {
  const normalizedHeaders = headers.map((header) => normalizeText(header));

  const explicitDateHeaderIndexes = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter((item) => /(data|dia|date|datahora|data\/hora)/.test(item.header))
    .map((item) => item.index);

  // If there are explicit date headers (e.g. DATA and Data/Hora), choose the one
  // with the strongest parseable-date signal from real rows.
  if (explicitDateHeaderIndexes.length > 0) {
    let bestIndex = explicitDateHeaderIndexes[0];
    let bestScore = -1;

    for (const columnIndex of explicitDateHeaderIndexes) {
      let parseableCount = 0;
      for (const row of dataRows.slice(0, 120)) {
        const raw = String(row[columnIndex] ?? "");
        if (toIsoDate(raw)) {
          parseableCount += 1;
        }
      }

      // Small bonus to keep DATA preferred when signals tie.
      const header = normalizedHeaders[columnIndex] ?? "";
      const headerBonus = header === "data" ? 1 : 0;
      const score = parseableCount * 3 + headerBonus;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = columnIndex;
      }
    }

    return bestIndex;
  }

  const maxColumns = Math.max(
    headers.length,
    ...dataRows.slice(0, 20).map((row) => row.length)
  );

  let bestIndex = 0;
  let bestScore = -1;

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex++) {
    const header = normalizedHeaders[columnIndex] ?? "";
    const headerBonus = /(data|dia|date)/.test(header) ? 10 : 0;

    let parseableCount = 0;
    for (const row of dataRows.slice(0, 20)) {
      const raw = String(row[columnIndex] ?? "");
      if (!isStrictDateLikeText(raw)) {
        continue;
      }

      const iso = toIsoDate(raw);
      if (iso) {
        parseableCount += 1;
      }
    }

    const score = headerBonus + parseableCount * 3;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = columnIndex;
    }
  }

  return bestIndex;
}

function findDateColumns(headers: string[], dataRows: string[][]): number[] {
  const primary = findDateColumn(headers, dataRows);
  const normalizedHeaders = headers.map((header) => normalizeText(header));

  const explicit = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter((item) => /(data|dia|date|datahora|data\/hora)/.test(item.header))
    .map((item) => item.index);

  const unique = new Set<number>([primary]);

  for (const columnIndex of explicit) {
    if (columnIndex === primary) {
      continue;
    }

    const parseableCount = dataRows.slice(0, 120).reduce((acc, row) => {
      const raw = String(row[columnIndex] ?? "");
      return acc + (toIsoDate(raw) ? 1 : 0);
    }, 0);

    if (parseableCount > 0) {
      unique.add(columnIndex);
    }
  }

  return Array.from(unique);
}

function findCaseColumn(headers: string[]): number | null {
  const index = headers.findIndex((header) => /(caso|case)/.test(normalizeText(header)));
  return index >= 0 ? index : null;
}

function findTimeColumn(headers: string[]): number | null {
  const index = headers.findIndex((header) => {
    const normalized = normalizeText(header);
    return /(hora|horario|time)/.test(normalized) && !/(data|date|dia)/.test(normalized);
  });
  return index >= 0 ? index : null;
}

function normalizeTimePart(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const serial = Number(trimmed);
  if (Number.isFinite(serial) && serial >= 0 && serial < 1) {
    const totalSeconds = Math.round(serial * 24 * 60 * 60);
    const hours = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  const hm = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hm) {
    const hour = hm[1].padStart(2, "0");
    const minute = hm[2];
    const second = (hm[3] ?? "00").padStart(2, "0");
    return `${hour}:${minute}:${second}`;
  }

  return null;
}

function combineDateAndTime(dateCell: string, timeCell: string | null): string {
  if (!timeCell || /\d{1,2}:\d{2}/.test(dateCell)) {
    return dateCell;
  }

  const normalizedTime = normalizeTimePart(timeCell);
  if (!normalizedTime) {
    return dateCell;
  }

  return `${dateCell} ${normalizedTime}`;
}

function normalizeCaseId(value: string): string | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/[^a-zA-Z0-9-]/g, "");
  return normalized ? normalized.toLowerCase() : null;
}

function findHeaderAndDataRows(
  rows: string[][],
  keywords: string[]
): { headers: string[]; dataRows: string[][] } {
  const scanLimit = Math.min(rows.length, 80);
  let bestIndex = 0;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const normalized = row.map((cell) => normalizeText(String(cell ?? "")));
    const nonEmptyCells = normalized.filter(Boolean).length;
    const keywordMatches = normalized.reduce((acc, cell) => {
      if (!cell) {
        return acc;
      }
      return acc + (keywords.some((keyword) => cell.includes(keyword)) ? 1 : 0);
    }, 0);

    const dateColumns = normalized
      .map((cell, index) => ({ cell, index }))
      .filter((item) => /(data|dia|date)/.test(item.cell))
      .map((item) => item.index);

    const valueColumns = normalized
      .map((cell, index) => ({ cell, index }))
      .filter((item) => {
        if (!item.cell) {
          return false;
        }
        if (/(data|dia|date|caso|case)/.test(item.cell)) {
          return false;
        }
        return keywords.some((keyword) => item.cell.includes(keyword));
      })
      .map((item) => item.index);

    let dataSignal = 0;
    const sampleRows = rows.slice(rowIndex + 1, rowIndex + 41);
    for (const sampleRow of sampleRows) {
      const dateColumnsToUse = dateColumns.length
        ? dateColumns
        : sampleRow.map((_, index) => index).slice(0, 3);

      if (
        dateColumnsToUse.some((columnIndex) =>
          Boolean(toIsoDate(String(sampleRow[columnIndex] ?? "")))
        )
      ) {
        dataSignal += 3;
      }

      for (const columnIndex of valueColumns) {
        if (parseNumber(String(sampleRow[columnIndex] ?? "0")) > 0) {
          dataSignal += 2;
        }
      }
    }

    const score = keywordMatches * 10 + nonEmptyCells + dataSignal;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
    }
  }

  const headers = (rows[bestIndex] ?? []).map(String);
  const dataRows = rows.slice(bestIndex + 1);

  return { headers, dataRows };
}

function shouldIncludeRow(
  rowDate: string | null,
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
): boolean {
  if (!rowDate) {
    return !dateFilter && !monthFilter && !yearFilter;
  }

  if (dateFilter && rowDate !== dateFilter) {
    return false;
  }

  if (monthFilter) {
    const month = Number(rowDate.split("-")[1]);
    if (month !== monthFilter) {
      return false;
    }
  }

  if (yearFilter && !rowDate.startsWith(`${yearFilter}-`)) {
    return false;
  }

  return true;
}

function pickBestRowDate(
  rowDates: string[],
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
): string | null {
  if (!rowDates.length) {
    return null;
  }

  const exactMatch = dateFilter ? rowDates.find((item) => item === dateFilter) : null;
  if (exactMatch) {
    return exactMatch;
  }

  const monthYearMatch = rowDates.find((item) =>
    shouldIncludeRow(item, null, monthFilter, yearFilter)
  );
  if (monthYearMatch) {
    return monthYearMatch;
  }

  return rowDates[0] ?? null;
}

function matchColumns(headers: string[], patterns: string[]): number[] {
  return headers
    .map((header, index) => ({ header: normalizeText(header), index }))
    .filter((item) => patterns.some((pattern) => item.header.includes(pattern)))
    .map((item) => item.index);
}

export function buildOperatorsReport(
  input: Array<{ operator: string; rows: string[][] }>,
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
): OperatorsReport {
  const metricsByOperator = new Map<
    string,
    { preparo: number; liberacao: number; scanner: number; mio: number; air: number }
  >();

  type CaseEvent = {
    operator: string;
    metric: OperatorMetricKey;
    caseId: string;
    timestamp: number;
  };

  const dedupEvents: CaseEvent[] = [];
  const duplicates: OperatorDuplicateItem[] = [];

  function getOperatorMetrics(operator: string) {
    const existing = metricsByOperator.get(operator);
    if (existing) {
      return existing;
    }

    const created = {
      preparo: 0,
      liberacao: 0,
      scanner: 0,
      mio: 0,
      air: 0,
    };
    metricsByOperator.set(operator, created);
    return created;
  }

  for (const { operator, rows } of input) {
    const { headers, dataRows } = findHeaderAndDataRows(rows, [
      "data",
      "caso",
      "scanner",
      "prepar",
      "libera",
      "mio",
      "air",
    ]);

    const dateColumns = findDateColumns(headers, dataRows);
    const dateColumn = dateColumns[0] ?? 0;
    const preparoColumns = matchColumns(headers, ["prepar"]);
    const liberacaoColumns = matchColumns(headers, ["libera"]);
    const scannerColumns = matchColumns(headers, ["scanner"]);
    const mioColumns = matchColumns(headers, ["mio"]);
    const airColumns = matchColumns(headers, ["air"]);

    const metrics = getOperatorMetrics(operator);
    const caseColumn = findCaseColumn(headers);
    const timeColumn = findTimeColumn(headers);

    for (const row of dataRows) {
      const rowDates = dateColumns
        .map((columnIndex) => toIsoDate(String(row[columnIndex] ?? "")))
        .filter((value): value is string => Boolean(value));

      const rowDate = pickBestRowDate(rowDates, dateFilter, monthFilter, yearFilter);
      if (!shouldIncludeRow(rowDate, dateFilter, monthFilter, yearFilter)) {
        continue;
      }

      const rawDateCell = row[dateColumn] ?? "";
      const rawTimeCell = timeColumn !== null ? String(row[timeColumn] ?? "") : null;
      const rowDateTime = combineDateAndTime(String(rawDateCell), rawTimeCell);

      const applyDedupRule = Boolean(
        rowDate && rowDate >= DEDUP_START_DATE && caseColumn !== null
      );

      const caseId = applyDedupRule
        ? normalizeCaseId(String(row[caseColumn ?? -1] ?? ""))
        : null;

      const rowTimestamp = toTimestamp(rowDateTime) ?? toTimestamp(String(rawDateCell)) ?? 0;

      const metricColumns: Array<{ metric: OperatorMetricKey; columns: number[] }> = [
        { metric: "preparo", columns: preparoColumns },
        { metric: "liberacao", columns: liberacaoColumns },
        { metric: "scanner", columns: scannerColumns },
        { metric: "mio", columns: mioColumns },
        { metric: "air", columns: airColumns },
      ];

      for (const metricColumn of metricColumns) {
        const rawValue = metricColumn.columns.reduce(
          (acc, column) => acc + parseNumber(row[column] ?? "0"),
          0
        );

        if (rawValue <= 0) {
          continue;
        }

        if (applyDedupRule && caseId) {
          dedupEvents.push({
            operator,
            metric: metricColumn.metric,
            caseId,
            timestamp: rowTimestamp,
          });
          continue;
        }

        metrics[metricColumn.metric] += rawValue;
      }
    }
  }

  dedupEvents.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.operator.localeCompare(b.operator);
  });

  const lastAcceptedByCaseAndMetric = new Map<
    string,
    { timestamp: number; operator: string }
  >();
  for (const event of dedupEvents) {
    const dedupKey = `${event.metric}:${event.caseId}`;
    const lastAccepted = lastAcceptedByCaseAndMetric.get(dedupKey);

    if (
      lastAccepted !== undefined &&
      event.timestamp - lastAccepted.timestamp < THIRTY_DAYS_MS
    ) {
      duplicates.push({
        caseId: event.caseId,
        metric: event.metric,
        firstOperator: lastAccepted.operator,
        duplicateOperator: event.operator,
        firstTimestamp: formatTimestampForUi(lastAccepted.timestamp),
        duplicateTimestamp: formatTimestampForUi(event.timestamp),
      });
      continue;
    }

    const metrics = getOperatorMetrics(event.operator);
    metrics[event.metric] += 1;
    lastAcceptedByCaseAndMetric.set(dedupKey, {
      timestamp: event.timestamp,
      operator: event.operator,
    });
  }

  duplicates.sort((a, b) => {
    const tsA = new Date(a.duplicateTimestamp).getTime();
    const tsB = new Date(b.duplicateTimestamp).getTime();
    return tsB - tsA;
  });

  const operators: OperatorReportItem[] = input.map(({ operator }) => {
    const metrics = getOperatorMetrics(operator);
    const total =
      metrics.preparo + metrics.liberacao + metrics.scanner + metrics.mio + metrics.air;

    return {
      operator,
      ...metrics,
      total,
    };
  });

  const totals = operators.reduce(
    (acc, item) => {
      acc.preparo += item.preparo;
      acc.liberacao += item.liberacao;
      acc.scanner += item.scanner;
      acc.mio += item.mio;
      acc.air += item.air;
      acc.total += item.total;
      return acc;
    },
    {
      preparo: 0,
      liberacao: 0,
      scanner: 0,
      mio: 0,
      air: 0,
      total: 0,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    dateFilter,
    monthFilter,
    yearFilter,
    totals,
    operators,
    duplicates,
  };
}

export function inspectOperatorRows(
  rows: string[][],
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
) {
  const { headers, dataRows } = findHeaderAndDataRows(rows, [
    "data",
    "caso",
    "scanner",
    "prepar",
    "libera",
    "mio",
    "air",
  ]);

  const dateColumns = findDateColumns(headers, dataRows);
  const metricColumns = {
    preparo: matchColumns(headers, ["prepar"]),
    liberacao: matchColumns(headers, ["libera"]),
    scanner: matchColumns(headers, ["scanner"]),
    mio: matchColumns(headers, ["mio"]),
    air: matchColumns(headers, ["air"]),
  };

  let includedRows = 0;
  const dateMatchesPerColumn: Record<number, number> = {};
  const sumsBeforeDedup = {
    preparo: 0,
    liberacao: 0,
    scanner: 0,
    mio: 0,
    air: 0,
  };

  for (const row of dataRows) {
    const rowDates = dateColumns
      .map((columnIndex) => ({
        columnIndex,
        iso: toIsoDate(String(row[columnIndex] ?? "")),
      }))
      .filter((entry): entry is { columnIndex: number; iso: string } => Boolean(entry.iso));

    for (const entry of rowDates) {
      if (dateFilter && entry.iso === dateFilter) {
        dateMatchesPerColumn[entry.columnIndex] =
          (dateMatchesPerColumn[entry.columnIndex] ?? 0) + 1;
      }
    }

    const rowDate = pickBestRowDate(
      rowDates.map((entry) => entry.iso),
      dateFilter,
      monthFilter,
      yearFilter
    );
    if (!shouldIncludeRow(rowDate, dateFilter, monthFilter, yearFilter)) {
      continue;
    }

    includedRows += 1;
    sumsBeforeDedup.preparo += metricColumns.preparo.reduce(
      (acc, column) => acc + parseNumber(row[column] ?? "0"),
      0
    );
    sumsBeforeDedup.liberacao += metricColumns.liberacao.reduce(
      (acc, column) => acc + parseNumber(row[column] ?? "0"),
      0
    );
    sumsBeforeDedup.scanner += metricColumns.scanner.reduce(
      (acc, column) => acc + parseNumber(row[column] ?? "0"),
      0
    );
    sumsBeforeDedup.mio += metricColumns.mio.reduce(
      (acc, column) => acc + parseNumber(row[column] ?? "0"),
      0
    );
    sumsBeforeDedup.air += metricColumns.air.reduce(
      (acc, column) => acc + parseNumber(row[column] ?? "0"),
      0
    );
  }

  return {
    inspectorVersion: "v2-header-signal",
    headers,
    totalRows: rows.length,
    dataRows: dataRows.length,
    dateColumns,
    metricColumns,
    includedRows,
    dateMatchesPerColumn,
    sumsBeforeDedup,
  };
}

export function buildMoversReport(
  input: Array<{ movimentador: string; rows: string[][] }>,
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
): MoversReport {
  const movimentadores: MoverReportItem[] = [];

  for (const { movimentador, rows } of input) {
    const { headers, dataRows } = findHeaderAndDataRows(rows, [
      "data",
      "moviment",
      "quant",
      "qtd",
      "total",
    ]);

    const dateColumn = findDateColumn(headers, dataRows);
    const movementColumns = matchColumns(headers, [
      "moviment",
      "quantidade",
      "qtd",
      "total",
    ]).filter((column) => column !== dateColumn);

    let movimentacoes = 0;

    for (const row of dataRows) {
      const rowDate = toIsoDate(row[dateColumn] ?? "");
      if (!shouldIncludeRow(rowDate, dateFilter, monthFilter, yearFilter)) {
        continue;
      }

      const columnsToUse = movementColumns.length
        ? movementColumns
        : row.map((_, index) => index).filter((index) => index !== dateColumn);

      for (const column of columnsToUse) {
        movimentacoes += parseNumber(row[column] ?? "0");
      }
    }

    movimentadores.push({ movimentador, movimentacoes });
  }

  const totalMovimentacoes = movimentadores.reduce(
    (acc, item) => acc + item.movimentacoes,
    0
  );

  return {
    generatedAt: new Date().toISOString(),
    dateFilter,
    monthFilter,
    yearFilter,
    totalMovimentacoes,
    movimentadores,
  };
}
