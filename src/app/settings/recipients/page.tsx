"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Users,
  Truck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Phone,
  ShieldAlert,
} from "lucide-react";

export default function RecipientsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delivery Courier states
  const [deliveryName, setDeliveryName] = useState("Entregador Principal");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [onlyDeliveryOrders, setOnlyDeliveryOrders] = useState(true);

  // Owner states
  const [ownerName, setOwnerName] = useState("Proprietário");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEnabled, setOwnerEnabled] = useState(false);
  const [notifyOnNewOrder, setNotifyOnNewOrder] = useState(true);
  const [notifyOnCancelled, setNotifyOnCancelled] = useState(true);
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);

  const fetchRecipients = async () => {
    try {
      const res = await fetch("/api/settings/recipients");
      if (res.ok) {
        const data = await res.json();
        if (data.delivery) {
          setDeliveryName(data.delivery.name || "Entregador Principal");
          setDeliveryPhone(data.delivery.phone || "");
          setDeliveryEnabled(data.delivery.enabled ?? true);
          setOnlyDeliveryOrders(data.delivery.onlyDeliveryOrders ?? true);
        }
        if (data.owner) {
          setOwnerName(data.owner.name || "Proprietário");
          setOwnerPhone(data.owner.phone || "");
          setOwnerEnabled(data.owner.enabled ?? false);
          setNotifyOnNewOrder(data.owner.notifyOnNewOrder ?? true);
          setNotifyOnCancelled(data.owner.notifyOnCancelled ?? true);
          setNotifyOnFailure(data.owner.notifyOnFailure ?? true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/recipients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery: {
            name: deliveryName,
            phone: deliveryPhone,
            enabled: deliveryEnabled,
            onlyDeliveryOrders,
          },
          owner: {
            name: ownerName,
            phone: ownerPhone,
            enabled: ownerEnabled,
            notifyOnNewOrder,
            notifyOnCancelled,
            notifyOnFailure,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({ type: "success", text: "Destinatários guardados com sucesso!" });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Destinatários das Notificações
          </h1>
          <p className="text-sm text-slate-500">
            Configure separadamente para quem devem ser encaminhadas as mensagens de cada encomenda.
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

        <form onSubmit={handleSave} className="space-y-6">
          {/* SECTION 1: Delivery Courier (Entregador) */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">1. WhatsApp do Entregador</h2>
                  <p className="text-xs text-slate-500">
                    Recebe os detalhes da rota, endereço, contacto do cliente e valor a cobrar.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={deliveryEnabled}
                  onChange={(e) => setDeliveryEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Nome do Entregador
                </label>
                <input
                  type="text"
                  required
                  value={deliveryName}
                  onChange={(e) => setDeliveryName(e.target.value)}
                  placeholder="Ex: Carlos (Estafeta Maputo)"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Número de WhatsApp
                </label>
                <input
                  type="text"
                  required
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="Ex: 841234567 ou +258841234567"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyDeliveryOrders}
                  onChange={(e) => setOnlyDeliveryOrders(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Enviar apenas encomendas que necessitam de entrega física ao domicílio</span>
              </label>
            </div>
          </div>

          {/* SECTION 2: Store Owner (Proprietário) */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">2. WhatsApp do Proprietário (Opcional)</h2>
                  <p className="text-xs text-slate-500">
                    Notificações operacionais de novas vendas e alertas de encomendas com problemas.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownerEnabled}
                  onChange={(e) => setOwnerEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Nome do Proprietário
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Número de WhatsApp
                </label>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="Ex: 821234567 ou +258821234567"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {ownerEnabled && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Eventos para Notificar o Proprietário:
                </p>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnNewOrder}
                      onChange={(e) => setNotifyOnNewOrder(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Notificar quando for criada uma nova encomenda</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnCancelled}
                      onChange={(e) => setNotifyOnCancelled(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Notificar quando uma encomenda for cancelada</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnFailure}
                      onChange={(e) => setNotifyOnFailure(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Alertar quando uma encomenda estiver sem telefone e necessitar de revisão manual</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Customer Phone Resolution Hierarchy Info */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-slate-800 font-semibold text-sm">
              <Phone className="h-4 w-4 text-emerald-600" />
              <span>3. Contacto do Cliente (Extração Automática)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              O número de WhatsApp do cliente é obtido automaticamente do pedido Shopify seguindo a ordem estrita de prioridade:
            </p>
            <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1 font-medium">
              <li>Telefone do endereço de entrega (<code className="text-slate-800">shipping_address.phone</code>)</li>
              <li>Telefone da encomenda ou faturação (<code className="text-slate-800">order.phone / billing_address.phone</code>)</li>
              <li>Telefone do perfil do cliente (<code className="text-slate-800">customer.phone</code>)</li>
            </ol>
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
              <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Regra de Integridade:</strong> Nunca inventamos números nem enviamos mensagens para contactos inválidos. Caso o cliente não informe um telefone válido, a encomenda é sinalizada para revisão manual no painel.
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 shadow-sm"
            >
              {saving ? "A guardar..." : "Guardar Destinatários"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
