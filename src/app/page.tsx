"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MoversReport, OperatorsReport } from "@/lib/reports/types";

type TabKey = "operators" | "movers";

const AUTO_REFRESH_MS = 2 * 60 * 1000;

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("operators");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [operatorsData, setOperatorsData] = useState<OperatorsReport | null>(null);
  const [moversData, setMoversData] = useState<MoversReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryDate = useMemo(() => selectedDate || null, [selectedDate]);
  const queryYear = useMemo(() => (selectedYear ? Number(selectedYear) : null), [selectedYear]);
  const availableYears = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => String(now - index));
  }, []);

  const fetchReports = useCallback(
    async (forceRefresh: boolean) => {
      const params = new URLSearchParams();
      if (queryDate) {
        params.set("date", queryDate);
      }
      if (queryYear) {
        params.set("year", String(queryYear));
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
    [queryDate, queryYear]
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
        </div>
      </section>

      {error ? (
        <section className="brand-card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>
      ) : null}

      {activeTab === "operators" ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Filtro</p>
              <p className="text-lg font-bold text-brand-primary">{formatDateLabel(queryDate)}</p>
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
                      <td className="px-4 py-3 font-bold text-brand-primary">{formatNumber(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <article className="brand-card p-4">
              <p className="text-xs uppercase text-slate-500">Filtro</p>
              <p className="text-lg font-bold text-brand-primary">{formatDateLabel(queryDate)}</p>
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
      )}
    </div>
  );
}
