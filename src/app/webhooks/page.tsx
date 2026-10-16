"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Webhook,
  Copy,
  Check,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
} from "lucide-react";

export default function WebhookSettingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Mode and n8n settings
  const [mode, setMode] = useState<"DIRECT" | "N8N">("DIRECT");
  const [n8nUrl, setN8nUrl] = useState("");
  const [savingMode, setSavingMode] = useState(false);

  // Test event states
  const [testLoading, setTestLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchWebhookData = async () => {
    try {
      const res = await fetch("/api/webhooks/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setMode(json.processingMode || "DIRECT");
        setN8nUrl(json.n8nWebhookUrl || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhookData();
  }, []);

  const handleCopy = (text: string, isSecret = false) => {
    navigator.clipboard.writeText(text);
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!confirm("Tem certeza que deseja regenerar o segredo? Terá de atualizar a chave na Shopify.")) {
      return;
    }

    try {
      const res = await fetch("/api/webhooks/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateSecret: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setFeedback({ type: "success", text: "Novo segredo criptográfico gerado com sucesso!" });
      fetchWebhookData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  const handleSaveMode = async () => {
    setSavingMode(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/webhooks/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processingMode: mode,
          n8nWebhookUrl: n8nUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setFeedback({ type: "success", text: "Modo de processamento atualizado!" });
      fetchWebhookData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSavingMode(false);
    }
  };

  const handleSendTestWebhook = async () => {
    setTestLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setFeedback({ type: "success", text: json.message });
      fetchWebhookData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Webhook da Shopify
          </h1>
          <p className="text-sm text-slate-500">
            Endpoint protegido por verificação criptográfica HMAC para receção de eventos de encomenda.
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

        {/* Webhook URL & Secret Card */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Endereço de Destino (Callback URL)</h2>
            <button
              onClick={handleSendTestWebhook}
              disabled={testLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{testLoading ? "A simular..." : "Enviar Evento de Teste"}</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                URL do Webhook da sua Loja
              </label>
              <div className="flex rounded-lg shadow-xs">
                <input
                  type="text"
                  readOnly
                  value={data?.webhookUrl || "A carregar..."}
                  className="block w-full rounded-l-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-mono text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(data?.webhookUrl || "")}
                  className="inline-flex items-center gap-1.5 rounded-r-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedUrl ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Segredo HMAC para n8n (não é o da Shopify)
              </label>
              <div className="flex rounded-lg shadow-xs">
                <input
                  type="password"
                  readOnly
                  value={data?.webhookSecret || "••••••••••••••••••••"}
                  className="block w-full rounded-l-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-mono text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(data?.webhookSecret || "", true)}
                  className="inline-flex items-center gap-1.5 border-t border-b border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedSecret ? "Copiado!" : "Copiar"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateSecret}
                  className="rounded-r-lg border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Regenerar
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                A Shopify assina webhooks com SHOPIFY_API_SECRET do .env. Este segredo serve apenas para autenticar o encaminhamento para o n8n.
              </p>
            </div>
          </div>
        </div>

        {/* Processing Mode: Mode A (Direct) vs Mode B (n8n) */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Modo de Execução</h2>
              <p className="text-xs text-slate-500">
                Escolha se o evento é tratado diretamente pela aplicação ou encaminhado para o seu fluxo n8n.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                mode === "DIRECT"
                  ? "border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/10"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">Modo A: Processamento Direto</span>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "DIRECT"}
                  onChange={() => setMode("DIRECT")}
                  className="text-emerald-600"
                />
              </div>
              <p className="text-xs text-slate-500">
                Shopify → Backend Next.js → Fila de tarefas → Evolution API. (Recomendado)
              </p>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                mode === "N8N"
                  ? "border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/10"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-900">Modo B: Integração via n8n</span>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "N8N"}
                  onChange={() => setMode("N8N")}
                  className="text-emerald-600"
                />
              </div>
              <p className="text-xs text-slate-500">
                Shopify → Endpoint seguro → Encaminhar para o seu webhook n8n → Evolution API.
              </p>
            </label>
          </div>

          {mode === "N8N" && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                URL do Webhook do seu n8n
              </label>
              <input
                type="url"
                required
                placeholder="https://n8n.seuservidor.com/webhook/shopify-order"
                value={n8nUrl}
                onChange={(e) => setN8nUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400">
                O payload será assinado digitalmente no cabeçalho <code className="text-slate-600">X-NotifySell-Signature</code>.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSaveMode}
              disabled={savingMode}
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              {savingMode ? "A guardar..." : "Guardar Modo de Execução"}
            </button>
          </div>
        </div>

        {/* Live Statistics & Events Log */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-base">Métricas do Webhook</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400">Eventos Recebidos</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{data?.totalEvents ?? 0}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400">Último Tópico</span>
              <p className="text-xs font-mono font-semibold text-slate-800 mt-2 truncate">
                {data?.lastEventTopic || "Nenhum"}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400">Última Validação</span>
              <p className="text-xs font-semibold text-emerald-600 mt-2">
                {data?.lastEventStatus || "Pendente"}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400">Última Receção</span>
              <p className="text-xs text-slate-700 mt-2">
                {data?.lastEventReceivedAt
                  ? new Date(data.lastEventReceivedAt).toLocaleTimeString("pt-MZ")
                  : "Sem registos"}
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 space-y-3 text-xs text-slate-600 leading-relaxed">
          <h4 className="font-bold text-slate-900 text-sm">Instruções para Configuração Manual na Shopify:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>No painel da sua loja Shopify, clique em <strong>Configurações (Settings)</strong> &gt; <strong>Notificações (Notifications)</strong>.</li>
            <li>Desça até à secção <strong>Webhooks</strong> e clique em <strong>Criar webhook</strong>.</li>
            <li>No campo Evento, selecione <strong>Criação de encomenda (Order creation)</strong>.</li>
            <li>Formato: <strong>JSON</strong>.</li>
            <li>No URL, cole o endereço do webhook acima.</li>
            <li>Versão da API do webhook: selecione a versão mais recente estável.</li>
          </ol>
        </div>
      </div>
    </AppShell>
  );
}
