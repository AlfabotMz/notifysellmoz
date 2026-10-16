"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  X,
  Phone,
  MapPin,
} from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selected Order for Detail Modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/orders", window.location.origin);
      if (search) url.searchParams.set("search", search);
      if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
        setTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleOpenDetail = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailLoading(true);
    setActionFeedback(null);

    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const json = await res.json();
        setOrderDetail(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRetryNotification = async (notificationId: string) => {
    setRetryingId(notificationId);
    setActionFeedback(null);

    try {
      const res = await fetch(`/api/notifications/${notificationId}/retry`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao reenviar");

      setActionFeedback("Tentativa de reenvio concluída com sucesso!");
      // Refresh order details and table
      if (selectedOrderId) handleOpenDetail(selectedOrderId);
      fetchOrders();
    } catch (err: any) {
      setActionFeedback(`Erro no reenvio: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Enviado
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" /> Falhou
          </span>
        );
      case "UNCERTAIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> Incerto
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" /> Pendente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-100">
            Não enviado
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Encomendas e Histórico de Envios
          </h1>
          <p className="text-sm text-slate-500">
            Consulte todas as encomendas recebidas da Shopify e o estado de entrega das mensagens WhatsApp.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por encomenda, cliente ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </form>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-white rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Todas as Encomendas</option>
              <option value="COD">Contra Entrega</option>
              <option value="PAID">Pagas</option>
              <option value="CANCELLED">Canceladas</option>
              <option value="INVALID_PHONE">Sem Telefone Válido</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Encomenda</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4">Msg Cliente</th>
                  <th className="py-3.5 px-4">Msg Entregador</th>
                  <th className="py-3.5 px-4">Msg Dono</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      A carregar encomendas...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Nenhuma encomenda encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {o.orderNumber}
                        <div className="text-[11px] font-normal text-slate-400">
                          {new Date(o.createdAt).toLocaleDateString("pt-MZ")}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{o.customerName}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                          {o.customerPhone || "Sem telefone"}
                          {!o.phoneValid && (
                            <span className="text-[10px] text-amber-600 font-sans font-medium">(Inválido)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {Number(o.totalAmount).toLocaleString("pt-MZ", { minimumFractionDigits: 2 })} {o.currency}
                      </td>
                      <td className="py-3.5 px-4">
                        {o.cancelledAt ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Cancelada
                          </span>
                        ) : o.isCashOnDelivery ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Contra Entrega
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                            {o.financialStatus}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{renderStatusBadge(o.customerStatus)}</td>
                      <td className="py-3.5 px-4">{renderStatusBadge(o.deliveryStatus)}</td>
                      <td className="py-3.5 px-4">{renderStatusBadge(o.ownerStatus)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(o.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
              >
                Seguinte
              </button>
            </div>
          </div>
        </div>

        {/* Order Details Modal */}
        {selectedOrderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Encomenda {orderDetail?.order?.orderNumber}
                  </h3>
                  <span className="text-xs text-slate-400">
                    ID Externo Shopify: {orderDetail?.order?.externalOrderId}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {actionFeedback && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
                  {actionFeedback}
                </div>
              )}

              {detailLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  A carregar detalhes...
                </div>
              ) : orderDetail ? (
                <div className="space-y-6">
                  {/* Order Customer & Shipping Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">Dados do Cliente:</span>
                      <p className="text-slate-900 font-medium">{orderDetail.order.customerName}</p>
                      <p className="text-slate-600 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {orderDetail.order.customerPhone || "Nenhum telefone"}
                        <span className="text-slate-400">({orderDetail.order.phoneSource})</span>
                      </p>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">Local de Entrega:</span>
                      <p className="text-slate-700 flex items-start gap-1">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                        {orderDetail.order.deliveryAddress}
                      </p>
                    </div>
                  </div>

                  {/* Notifications Timeline */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">
                      Histórico de Mensagens WhatsApp
                    </h4>

                    {orderDetail.notifications?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhuma notificação enviada.</p>
                    ) : (
                      <div className="space-y-3">
                        {orderDetail.notifications.map((n: any) => (
                          <div
                            key={n.id}
                            className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">
                                {n.recipientType} ({n.recipientPhone})
                              </span>
                              <div className="flex items-center gap-2">
                                {renderStatusBadge(n.status)}
                                {(n.status === "FAILED" || n.status === "UNCERTAIN") && (
                                  <button
                                    onClick={() => handleRetryNotification(n.id)}
                                    disabled={retryingId === n.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-white text-[11px] font-semibold hover:bg-slate-700 disabled:opacity-50"
                                  >
                                    <RotateCcw className={`h-3 w-3 ${retryingId === n.id ? "animate-spin" : ""}`} />
                                    <span>{retryingId === n.id ? "A reenviar..." : "Repetir Envio"}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="p-2 rounded bg-slate-50 text-slate-700 whitespace-pre-wrap font-mono text-[11px] border border-slate-100">
                              {n.messageContent}
                            </p>

                            {n.lastError && (
                              <p className="text-rose-600 text-[11px] font-medium">
                                Erro: {n.lastError}
                              </p>
                            )}

                            <div className="text-[10px] text-slate-400 flex items-center justify-between">
                              <span>Tentativas: {n.attemptCount}</span>
                              <span>{new Date(n.createdAt).toLocaleString("pt-MZ")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
