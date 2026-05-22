"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MoversReport, OperatorsReport } from "@/lib/reports/types";

type TabKey = "operators" | "movers" | "duplicates";
type DuplicateFilterField = "none" | "caseId" | "metric" | "firstOperator" | "duplicateOperator";

const AUTO_REFRESH_MS = 10 * 60 * 1000;
const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateLabel(iso: string | null): string {
  if (!iso) {
    return "Acumulado geral";
  }

  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatMonthLabel(month: number | null): string {
  if (!month) {
    return "Todos";
  }

  return MONTH_LABELS[month - 1] ?? "Todos";
}

function formatMetricLabel(metric: string): string {
  switch (metric) {
    case "preparo":
      return "Preparo";
    case "liberacao":
      return "Liberação";
    case "scanner":
      return "Scanner";
    case "mio":
      return "MIO";
    case "air":
      return "AIR";
    default:
      return metric;
  }
}

function extractDatePartsFromPtBrDateTime(value: string): { month: string; year: string } | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) {
    return null;
  }

  return {
    month: match[2],
    year: match[3],
  };
}

function extractIsoDateFromPtBrDateTime(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) {
    return null;
  }

  const day = match[1];
  const month = match[2];
  const year = match[3];
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("operators");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [operatorsData, setOperatorsData] = useState<OperatorsReport | null>(null);
  const [moversData, setMoversData] = useState<MoversReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateFilterField, setDuplicateFilterField] =
    useState<DuplicateFilterField>("none");
  const [duplicateFilterValue, setDuplicateFilterValue] = useState<string>("");
  const [duplicateMonthFilter, setDuplicateMonthFilter] = useState<string>("");
  const [duplicateYearFilter, setDuplicateYearFilter] = useState<string>("");
  const [duplicateDateFilter, setDuplicateDateFilter] = useState<string>("");

  const queryDate = useMemo(() => selectedDate || null, [selectedDate]);
  const queryMonth = useMemo(() => (selectedMonth ? Number(selectedMonth) : null), [selectedMonth]);
  const queryYear = useMemo(() => (selectedYear ? Number(selectedYear) : null), [selectedYear]);
  const availableMonths = useMemo(
    () => MONTH_LABELS.map((label, index) => ({ value: String(index + 1), label })),
    []
  );
  const availableYears = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => String(now - index));
  }, []);

  const duplicateFilterOptions = useMemo(() => {
    const duplicates = operatorsData?.duplicates ?? [];

    if (duplicateFilterField === "none") {
      return [];
    }

    const values = duplicates.map((item) => {
      switch (duplicateFilterField) {
        case "caseId":
          return item.caseId.toUpperCase();
        case "metric":
          return formatMetricLabel(item.metric);
        case "firstOperator":
          return item.firstOperator;
        case "duplicateOperator":
          return item.duplicateOperator;
        default:
          return "";
      }
    });

    return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [operatorsData?.duplicates, duplicateFilterField]);

  const duplicateMonthOptions = useMemo(() => {
    const duplicates = operatorsData?.duplicates ?? [];
    const months = duplicates
      .map((item) => extractDatePartsFromPtBrDateTime(item.duplicateTimestamp)?.month ?? "")
      .filter(Boolean);

    return Array.from(new Set(months)).sort((a, b) => Number(a) - Number(b));
  }, [operatorsData?.duplicates]);

  const duplicateYearOptions = useMemo(() => {
    const duplicates = operatorsData?.duplicates ?? [];
    const years = duplicates
      .map((item) => extractDatePartsFromPtBrDateTime(item.duplicateTimestamp)?.year ?? "")
      .filter(Boolean);

    return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
  }, [operatorsData?.duplicates]);

  const duplicateDateOptions = useMemo(() => {
    const duplicates = operatorsData?.duplicates ?? [];
    const dates = duplicates
      .map((item) => extractIsoDateFromPtBrDateTime(item.duplicateTimestamp) ?? "")
      .filter(Boolean);

    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [operatorsData?.duplicates]);

  const filteredDuplicates = useMemo(() => {
    let filtered = operatorsData?.duplicates ?? [];

    if (duplicateMonthFilter) {
      filtered = filtered.filter((item) => {
        const parts = extractDatePartsFromPtBrDateTime(item.duplicateTimestamp);
        return parts?.month === duplicateMonthFilter;
      });
    }

    if (duplicateYearFilter) {
      filtered = filtered.filter((item) => {
        const parts = extractDatePartsFromPtBrDateTime(item.duplicateTimestamp);
        return parts?.year === duplicateYearFilter;
      });
    }

    if (duplicateDateFilter) {
      filtered = filtered.filter((item) => {
        const isoDate = extractIsoDateFromPtBrDateTime(item.duplicateTimestamp);
        return isoDate === duplicateDateFilter;
      });
    }

    if (duplicateFilterField === "none" || !duplicateFilterValue) {
      return filtered;
    }

    return filtered.filter((item) => {
      switch (duplicateFilterField) {
        case "caseId":
          return item.caseId.toUpperCase() === duplicateFilterValue;
        case "metric":
          return formatMetricLabel(item.metric) === duplicateFilterValue;
        case "firstOperator":
          return item.firstOperator === duplicateFilterValue;
        case "duplicateOperator":
          return item.duplicateOperator === duplicateFilterValue;
        default:
          return true;
      }
    });
  }, [
    operatorsData?.duplicates,
    duplicateFilterField,
    duplicateFilterValue,
    duplicateMonthFilter,
    duplicateYearFilter,
    duplicateDateFilter,
  ]);

  useEffect(() => {
    setDuplicateFilterValue("");
  }, [duplicateFilterField]);

  const fetchReports = useCallback(
    async (forceRefresh: boolean) => {
      const params = new URLSearchParams();
      if (queryDate) {
        params.set("date", queryDate);
      }
      if (queryYear) {
        params.set("year", String(queryYear));
      }
      if (queryMonth) {
        params.set("month", String(queryMonth));
      }
      if (forceRefresh) {
        params.set("refresh", "1");
      }

      const query = params.toString();
      const operatorsUrl = query
        ? `/api/reports/operators?${query}`
        : "/api/reports/operators";
      const moversUrl = query ? `/api/reports/movers?${query}` : "/api/reports/movers";

      const [operatorsResponse, moversResponse] = await Promise.all([
        fetch(operatorsUrl, { cache: "no-store" }),
        fetch(moversUrl, { cache: "no-store" }),
      ]);

      if (!operatorsResponse.ok) {
        const payload = (await operatorsResponse.json()) as { error?: string };
        throw new Error(payload.error ?? "Falha ao carregar relatorio de operadores.");
      }

      if (!moversResponse.ok) {
        const payload = (await moversResponse.json()) as { error?: string };
        throw new Error(payload.error ?? "Falha ao carregar relatorio de movimentadores.");
      }

      const operatorsPayload = (await operatorsResponse.json()) as OperatorsReport;
      const moversPayload = (await moversResponse.json()) as MoversReport;

      setOperatorsData(operatorsPayload);
      setMoversData(moversPayload);
      setError(null);
    },
    [queryDate, queryMonth, queryYear]
  );

  useEffect(() => {
    let canceled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        await fetchReports(false);
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
        }
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    };

    load();

    const timer = setInterval(() => {
      fetchReports(false).catch((err) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Erro ao atualizar dados.");
        }
      });
    }, AUTO_REFRESH_MS);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [fetchReports]);

  async function handleForceSync() {
    try {
      setIsSyncing(true);
      await fetchReports(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  }

  const lastUpdated = operatorsData?.generatedAt ?? moversData?.generatedAt ?? null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="brand-card brand-header flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Image
            src="/esthetic-aligner-logo.svg"
            alt="Esthetic Aligner"
            width={220}
            height={52}
            priority
          />
          <div>
            <h1 className="text-xl font-bold text-brand-primary sm:text-2xl">Dashboard Produtividade</h1>
            <p className="text-sm text-slate-600">
              {isLoading
                ? "Carregando dados das planilhas..."
                : `Atualizado em ${lastUpdated ? new Date(lastUpdated).toLocaleString("pt-BR") : "-"}`}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring"
          >
            <option value="">Todos os meses</option>
            {availableMonths.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring"
          >
            <option value="">Todos os anos</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring"
          />
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </div>
      </header>

      <section className="brand-card p-3">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("operators")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "operators"
                ? "bg-brand-primary text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Operadores
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("movers")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "movers"
                ? "bg-brand-primary text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Movimentadores
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("duplicates")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "duplicates"
                ? "bg-brand-primary text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Duplicidades
          </button>
        </div>
      </section>

      {error ? (
        <section className="brand-card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>
      ) : null}

      {activeTab === "operators" ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Filtro</p>
              <p className="text-lg font-bold text-brand-primary">{formatDateLabel(queryDate)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Mês</p>
              <p className="text-lg font-bold text-brand-primary">{formatMonthLabel(queryMonth)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Ano</p>
              <p className="text-lg font-bold text-brand-primary">{queryYear ?? "Todos"}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Preparo</p>
              <p className="text-2xl font-bold text-brand-primary">{formatNumber(operatorsData?.totals.preparo ?? 0)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Liberação</p>
              <p className="text-2xl font-bold text-brand-primary">{formatNumber(operatorsData?.totals.liberacao ?? 0)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Scanner</p>
              <p className="text-2xl font-bold text-brand-primary">{formatNumber(operatorsData?.totals.scanner ?? 0)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">MIO</p>
              <p className="text-2xl font-bold text-brand-primary">{formatNumber(operatorsData?.totals.mio ?? 0)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">AIR</p>
              <p className="text-2xl font-bold text-brand-primary">{formatNumber(operatorsData?.totals.air ?? 0)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Total</p>
              <p className="text-2xl font-bold text-brand-primary">{formatNumber(operatorsData?.totals.total ?? 0)}</p>
            </article>
          </div>

          <div className="brand-card overflow-hidden">
            <div className="border-b border-card-border bg-slate-50 px-4 py-3">
              <h2 className="font-semibold text-brand-primary">Total por Operador</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-slate-500">
                    <th className="px-4 py-3">Operador</th>
                    <th className="px-4 py-3">Preparo</th>
                    <th className="px-4 py-3">Liberação</th>
                    <th className="px-4 py-3">Scanner</th>
                    <th className="px-4 py-3">MIO</th>
                    <th className="px-4 py-3">AIR</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(operatorsData?.operators ?? []).map((item) => (
                    <tr key={item.operator} className="border-b border-card-border/70 text-slate-700">
                      <td className="px-4 py-3 font-medium">{item.operator}</td>
                      <td className="px-4 py-3">{formatNumber(item.preparo)}</td>
                      <td className="px-4 py-3">{formatNumber(item.liberacao)}</td>
                      <td className="px-4 py-3">{formatNumber(item.scanner)}</td>
                      <td className="px-4 py-3">{formatNumber(item.mio)}</td>
                      <td className="px-4 py-3">{formatNumber(item.air)}</td>
                      <td className="px-4 py-3 font-bold text-brand-primary">{formatNumber(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : activeTab === "movers" ? (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Filtro</p>
              <p className="text-lg font-bold text-brand-primary">{formatDateLabel(queryDate)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Mês</p>
              <p className="text-lg font-bold text-brand-primary">{formatMonthLabel(queryMonth)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Ano</p>
              <p className="text-lg font-bold text-brand-primary">{queryYear ?? "Todos"}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Movimentações</p>
              <p className="text-3xl font-bold text-brand-primary">{formatNumber(moversData?.totalMovimentacoes ?? 0)}</p>
            </article>
          </div>

          <div className="brand-card overflow-hidden">
            <div className="border-b border-card-border bg-slate-50 px-4 py-3">
              <h2 className="font-semibold text-brand-primary">Total por Movimentador</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-slate-500">
                    <th className="px-4 py-3">Movimentador</th>
                    <th className="px-4 py-3">Movimentações</th>
                  </tr>
                </thead>
                <tbody>
                  {(moversData?.movimentadores ?? []).map((item) => (
                    <tr key={item.movimentador} className="border-b border-card-border/70 text-slate-700">
                      <td className="px-4 py-3 font-medium">{item.movimentador}</td>
                      <td className="px-4 py-3 font-bold text-brand-primary">
                        {formatNumber(item.movimentacoes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Filtro</p>
              <p className="text-lg font-bold text-brand-primary">{formatDateLabel(queryDate)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Mês</p>
              <p className="text-lg font-bold text-brand-primary">{formatMonthLabel(queryMonth)}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Ano</p>
              <p className="text-lg font-bold text-brand-primary">{queryYear ?? "Todos"}</p>
            </article>
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Duplicidades</p>
              <p className="text-3xl font-bold text-brand-primary">
                {formatNumber(filteredDuplicates.length)}
              </p>
            </article>
          </div>

          <div className="brand-card p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Filtrar por
                </label>
                <select
                  value={duplicateFilterField}
                  onChange={(event) =>
                    setDuplicateFilterField(event.target.value as DuplicateFilterField)
                  }
                  className="w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring"
                >
                  <option value="none">Sem filtro</option>
                  <option value="caseId">Caso</option>
                  <option value="metric">Etapa</option>
                  <option value="firstOperator">Primeiro operador</option>
                  <option value="duplicateOperator">Operador que duplicou</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Valor
                </label>
                <select
                  value={duplicateFilterValue}
                  onChange={(event) => setDuplicateFilterValue(event.target.value)}
                  disabled={duplicateFilterField === "none"}
                  className="w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Todos</option>
                  {duplicateFilterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Mês
                </label>
                <select
                  value={duplicateMonthFilter}
                  onChange={(event) => setDuplicateMonthFilter(event.target.value)}
                  className="w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring"
                >
                  <option value="">Todos</option>
                  {duplicateMonthOptions.map((month) => (
                    <option key={month} value={month}>
                      {MONTH_LABELS[Number(month) - 1] ?? month}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Ano
                </label>
                <select
                  value={duplicateYearFilter}
                  onChange={(event) => setDuplicateYearFilter(event.target.value)}
                  className="w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring"
                >
                  <option value="">Todos</option>
                  {duplicateYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Data
                </label>
                <select
                  value={duplicateDateFilter}
                  onChange={(event) => setDuplicateDateFilter(event.target.value)}
                  className="w-full rounded-xl border border-card-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-brand-secondary/40 transition focus:ring"
                >
                  <option value="">Todas</option>
                  {duplicateDateOptions.map((date) => (
                    <option key={date} value={date}>
                      {formatDateLabel(date)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="brand-card overflow-hidden">
            <div className="border-b border-card-border bg-slate-50 px-4 py-3">
              <h2 className="font-semibold text-brand-primary">Casos Duplicados (Regra a partir de 01/05/2026)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-slate-500">
                    <th className="px-4 py-3">Caso</th>
                    <th className="px-4 py-3">Etapa</th>
                    <th className="px-4 py-3">Primeiro operador</th>
                    <th className="px-4 py-3">Data/Hora primeiro</th>
                    <th className="px-4 py-3">Operador que duplicou</th>
                    <th className="px-4 py-3">Data/Hora duplicado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDuplicates.length ? (
                    filteredDuplicates.map((item, index) => (
                      <tr
                        key={`${item.caseId}-${item.metric}-${item.firstOperator}-${item.duplicateOperator}-${item.duplicateTimestamp}-${index}`}
                        className="border-b border-card-border/70 text-slate-700"
                      >
                        <td className="px-4 py-3 font-medium uppercase">{item.caseId}</td>
                        <td className="px-4 py-3">{formatMetricLabel(item.metric)}</td>
                        <td className="px-4 py-3">{item.firstOperator}</td>
                        <td className="px-4 py-3">{item.firstTimestamp}</td>
                        <td className="px-4 py-3 font-semibold text-red-700">{item.duplicateOperator}</td>
                        <td className="px-4 py-3">{item.duplicateTimestamp}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        Nenhuma duplicidade encontrada para o filtro selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
