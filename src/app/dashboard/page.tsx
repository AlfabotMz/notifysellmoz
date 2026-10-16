"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  ShoppingBag,
  Send,
  Truck,
  AlertTriangle,
  Store,
  MessageSquare,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/dashboard/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Erro ao carregar métricas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/integrations/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha no envio de teste");
      }

      setTestResult({
        success: true,
        message: `Mensagem enviada com sucesso para ${data.sentTo}!`,
      });
      fetchMetrics();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message,
      });
    } finally {
      setTestSending(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const shopifyConnected = metrics?.shopifyConnected;
  const whatsappConnected = metrics?.whatsappConnected;

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Top Header with Store Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Painel de Controlo
            </h1>
            <p className="text-sm text-slate-500">
              Visão geral das encomendas, entregas e automações de WhatsApp
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setTestResult(null);
                setTestModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Testar Mensagem</span>
            </button>

            <Link
              href="/settings/shopify"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Store className="h-4 w-4 text-slate-500" />
              <span>Configurar Integração</span>
            </Link>
          </div>
        </div>

        {/* Integration Status Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Shopify Badge */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${shopifyConnected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Loja Shopify</p>
                <p className="text-sm font-semibold text-slate-900">
                  {metrics?.store?.shopDomain || "Não conectada"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                shopifyConnected
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {shopifyConnected ? "Conectada" : "Pendente"}
              </span>
              <Link href="/settings/shopify" className="text-slate-400 hover:text-slate-600">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* WhatsApp Badge */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${whatsappConnected ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Instância WhatsApp</p>
                <p className="text-sm font-semibold text-slate-900">
                  {metrics?.whatsappStatus === "CONNECTED"
                    ? "Conectado e Ativo"
                    : metrics?.whatsappStatus === "QRCODE"
                    ? "Aguardando Leitura QR"
                    : "Desconectado"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                whatsappConnected
                  ? "bg-emerald-100 text-emerald-800"
                  : metrics?.whatsappStatus === "QRCODE"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-slate-100 text-slate-800"
              }`}>
                {metrics?.whatsappStatus || "DESCONECTADO"}
              </span>
              <Link href="/settings/whatsapp" className="text-slate-400 hover:text-slate-600">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Orders Processed */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Encomendas Processadas</span>
              <ShoppingBag className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.ordersCount ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total registado na plataforma</p>
          </div>

          {/* Client Messages */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Mensagens ao Cliente</span>
              <Send className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.clientSentCount ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Confirmações de contra entrega</p>
          </div>

          {/* Delivery Messages */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Mensagens ao Entregador</span>
              <Truck className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.deliverySentCount ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Rotas de entrega atribuídas</p>
          </div>

          {/* Failures */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Mensagens com Falha</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.failedCount ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Requerem atenção ou repetição</p>
          </div>
        </div>

        {/* Informative Empty State if no orders exist */}
        {!metrics?.hasAnyData && (
          <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
              <Store className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Nenhuma encomenda processada ainda</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Conecte a sua loja Shopify e configure a sua instância do WhatsApp para começar a automatizar notificações aos clientes e entregadores.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/settings/shopify"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
              >
                Conectar Loja Shopify
              </Link>
              <Link
                href="/webhooks"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
              >
                Ver Webhook Shopify
              </Link>
            </div>
          </div>
        )}

        {/* Recent Orders & Errors Section */}
        {metrics?.hasAnyData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders (2 cols) */}
            <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 text-base">Últimas Encomendas</h3>
                <Link
                  href="/orders"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                      <th className="pb-2 font-medium">Encomenda</th>
                      <th className="pb-2 font-medium">Cliente</th>
                      <th className="pb-2 font-medium">Total (MZN)</th>
                      <th className="pb-2 font-medium">Tipo</th>
                      <th className="pb-2 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          Nenhuma encomenda recente
                        </td>
                      </tr>
                    ) : (
                      metrics.recentOrders.map((order: any) => (
                        <tr key={order.id} className="hover:bg-slate-50/60">
                          <td className="py-3 font-semibold text-slate-900">
                            {order.orderNumber}
                          </td>
                          <td className="py-3 text-slate-600">
                            {order.customerName}
                          </td>
                          <td className="py-3 font-medium text-slate-900">
                            {Number(order.totalAmount).toLocaleString("pt-MZ", { minimumFractionDigits: 2 })} {order.currency}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              order.isCashOnDelivery
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {order.isCashOnDelivery ? "Contra Entrega" : "Padrão"}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString("pt-MZ")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Errors (1 col) */}
            <div className="rounded-xl bg-white border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 text-base">Últimos Erros</h3>
                <span className="text-xs text-slate-400">Notificações</span>
              </div>

              {metrics.recentErrors.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  Nenhum erro de envio registado.
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.recentErrors.map((err: any) => (
                    <div
                      key={err.id}
                      className="p-3 rounded-lg bg-rose-50/50 border border-rose-100 text-xs text-slate-700"
                    >
                      <div className="flex items-center justify-between font-semibold text-rose-700 mb-1">
                        <span>{err.orderNumber} ({err.recipientType})</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(err.createdAt).toLocaleTimeString("pt-MZ")}
                        </span>
                      </div>
                      <p className="text-slate-600 line-clamp-2">{err.lastError}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Message Modal */}
        {testModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-base">Testar Envio de WhatsApp</h3>
                <button
                  onClick={() => setTestModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Envie uma mensagem de teste para o seu próprio número de telefone para verificar se a Evolution API está a funcionar.
              </p>

              {testResult && (
                <div className={`mb-4 p-3 rounded-lg text-xs ${
                  testResult.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}>
                  {testResult.message}
                </div>
              )}

              <form onSubmit={handleSendTestMessage} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Número de Telefone (com ou sem 258)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 841234567 ou +258841234567"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTestModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={testSending}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {testSending ? "A enviar..." : "Enviar Teste"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
