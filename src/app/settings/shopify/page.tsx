"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Store,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Unplug,
  ShieldCheck,
  Radio,
} from "lucide-react";

export default function ShopifySettingsPage() {
  const [shopDomain, setShopDomain] = useState("");
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/integrations/shopify/status");
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (data.shopDomain && !shopDomain) {
          setShopDomain(data.shopDomain);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Check URL parameters for OAuth return
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setFeedback({ type: "success", text: "Loja Shopify conectada com sucesso!" });
    } else if (params.get("error")) {
      setFeedback({ type: "error", text: `Erro na conexão Shopify: ${params.get("error")}` });
    }
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopDomain.trim()) return;

    // Trigger OAuth redirect
    window.location.href = `/api/integrations/shopify/connect?shop=${encodeURIComponent(shopDomain.trim())}`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar esta loja Shopify? As automações serão pausadas.")) {
      return;
    }

    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/integrations/shopify/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: statusData?.storeId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({ type: "success", text: "Loja Shopify desconectada com sucesso." });
      fetchStatus();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Integração com a Shopify
          </h1>
          <p className="text-sm text-slate-500">
            Conecte a sua loja através do fluxo oficial OAuth para receber encomendas em tempo real.
          </p>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 text-sm ${
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Main Connection Box */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Conectar a Shopify</h2>
                <p className="text-xs text-slate-500">
                  Autenticação oficial via Shopify Partner App
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  statusData?.connected
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    statusData?.connected ? "bg-emerald-600" : "bg-amber-600"
                  }`}
                />
                {statusData?.connected ? "Loja Conectada" : "Não Conectada"}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {!statusData?.connected ? (
              <form onSubmit={handleConnect} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Domínio da Loja Shopify (.myshopify.com)
                  </label>
                  <div className="flex rounded-lg shadow-xs">
                    <input
                      type="text"
                      required
                      placeholder="minha-loja.myshopify.com"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      className="block w-full rounded-l-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-r-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
                    >
                      <Store className="h-4 w-4" />
                      <span>Conectar Shopify</span>
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Insira o domínio myshopify da sua loja. Você será redirecionado para autorizar o acesso.
                  </p>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Nome da Loja</span>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {statusData.shopName || "Loja Shopify"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Domínio</span>
                    <p className="text-sm font-mono text-slate-700 mt-0.5">
                      {statusData.shopDomain}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Última Sincronização</span>
                    <p className="text-sm text-slate-700 mt-0.5">
                      {statusData.lastSyncAt
                        ? new Date(statusData.lastSyncAt).toLocaleString("pt-MZ")
                        : "Hoje"}
                    </p>
                  </div>
                </div>

                {/* Webhook Events Configured */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-600" />
                    Subscrições de Webhooks Ativas
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { topic: "orders/create", desc: "Novas encomendas criadas" },
                      { topic: "orders/cancelled", desc: "Cancelamentos de encomenda" },
                      { topic: "orders/updated", desc: "Atualizações de pagamento" },
                    ].map((item) => (
                      <div
                        key={item.topic}
                        className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-center gap-2.5"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-mono font-medium text-slate-900">{item.topic}</p>
                          <p className="text-[11px] text-slate-500">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={fetchStatus}
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Testar Conexão</span>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm font-semibold hover:bg-rose-50 transition-colors"
                  >
                    <Unplug className="h-4 w-4" />
                    <span>{actionLoading ? "A desconectar..." : "Desconectar Loja"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
          <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-800">Segurança de Nível Bancário:</span> Os tokens de acesso da Shopify são encriptados em repouso com algoritmo AES-256-GCM e nunca são expostos na interface web ou partilhados entre diferentes lojas.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
