"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Shield,
  Server,
  KeyRound,
  ExternalLink,
} from "lucide-react";

export default function WhatsAppSettingsPage() {
  const [activeTab, setActiveTab] = useState<"instance" | "qrcode">("instance");

  // Form states
  const [baseUrl, setBaseUrl] = useState("");
  const [instanceName, setInstanceName] = useState("loja-principal");
  const [apiKey, setApiKey] = useState("");
  const [statusData, setStatusData] = useState<any>(null);

  // QR Code states
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Test message states
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Feedback & Loading
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/integrations/whatsapp/status");
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (data.evolutionBaseUrl) setBaseUrl(data.evolutionBaseUrl);
        else if (data.defaultBaseUrl) setBaseUrl(data.defaultBaseUrl);
        if (data.instanceName) setInstanceName(data.instanceName);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/integrations/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: statusData?.storeId || "default",
          baseUrl,
          instanceName,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({ type: "success", text: "Configuração da Evolution API guardada com sucesso!" });
      fetchStatus();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadQrCode = async () => {
    setQrLoading(true);
    setQrCodeData(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/integrations/whatsapp/qrcode");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Não foi possível carregar o QR Code");

      setQrCodeData(data.qrcode);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setQrLoading(false);
    }
  };

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
      if (!res.ok) throw new Error(data.error);

      setTestResult({
        success: true,
        message: `Mensagem enviada com sucesso para ${data.sentTo}!`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message,
      });
    } finally {
      setTestSending(false);
    }
  };

  const isConnected = statusData?.status === "CONNECTED";

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Conectar WhatsApp (Evolution API)
          </h1>
          <p className="text-sm text-slate-500">
            Associe o seu número de WhatsApp através da Evolution API para envio automatizado de mensagens.
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

        {/* Status Header Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isConnected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-base">Estado da Conexão</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isConnected
                      ? "bg-emerald-100 text-emerald-800"
                      : statusData?.status === "QRCODE"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {statusData?.status || "NÃO CONFIGURADO"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isConnected
                  ? "Instância emparelhada e pronta para enviar mensagens."
                  : "Conecte uma instância ou faça leitura do QR Code."}
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 self-start sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar Estado</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab("instance")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "instance"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Server className="h-4 w-4" />
            <span>Opção 1: Instância Existente</span>
          </button>

          <button
            onClick={() => setActiveTab("qrcode")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "qrcode"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Opção 2: Conectar via QR Code</span>
          </button>
        </div>

        {/* TAB 1: Instance Configuration */}
        {activeTab === "instance" && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Parâmetros da Evolution API
              </h2>
              <p className="text-xs text-slate-500">
                URL e API Key podem vir do .env (EVOLUTION_DEFAULT_BASE_URL e EVOLUTION_API_KEY).
                A instância continua a ser configurada por loja.
              </p>
            </div>

            <form onSubmit={handleSaveInstance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  URL Base da Evolution API
                </label>
                <input
                  type="url"
                  required
                  placeholder={statusData?.defaultBaseUrl || "https://api.meuservidorevolution.com"}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Protegido contra SSRF (endereços privados internos bloqueados em produção).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Nome da Instância
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="loja-principal"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    API Key da Instância / Global
                  </label>
                  <input
                    type="password"
                    required={!statusData?.configured && !statusData?.hasEnvApiKey}
                    placeholder={
                      statusData?.configured
                        ? "••••••••••••••••"
                        : statusData?.hasEnvApiKey
                          ? "A usar EVOLUTION_API_KEY do .env"
                          : "Cole a sua apikey aqui"
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {statusData?.hasEnvApiKey && (
                    <p className="text-[11px] text-emerald-600 mt-1">
                      Chave global detectada no ambiente. Deixe vazio para a usar.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? "A guardar..." : "Guardar e Verificar Conexão"}
                </button>

                <button
                  type="button"
                  onClick={fetchStatus}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  Consultar Estado do WhatsApp
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: QR Code Connect */}
        {activeTab === "qrcode" && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-6 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-base font-bold text-slate-900">
                Emparelhar WhatsApp com QR Code
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Abra o WhatsApp no seu telemóvel, vá a Dispositivos Conectados e aponte a câmara para o código abaixo.
              </p>
            </div>

            <div className="py-6 flex flex-col items-center justify-center">
              {qrLoading ? (
                <div className="h-64 w-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
                  <span className="text-xs">A solicitar QR Code à Evolution API...</span>
                </div>
              ) : qrCodeData?.base64 ? (
                <div className="space-y-3">
                  <div className="p-3 bg-white border-2 border-emerald-500/30 rounded-2xl shadow-sm inline-block">
                    <img
                      src={qrCodeData.base64.startsWith("data:") ? qrCodeData.base64 : `data:image/png;base64,${qrCodeData.base64}`}
                      alt="WhatsApp QR Code"
                      className="h-64 w-64 object-contain"
                    />
                  </div>
                  <p className="text-xs text-emerald-600 font-medium">
                    QR Code gerado! A aguardar leitura...
                  </p>
                </div>
              ) : (
                <div className="h-64 w-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-6">
                  <QrCode className="h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-xs">
                    {isConnected
                      ? "A sua conta WhatsApp já está conectada!"
                      : "Clique no botão abaixo para gerar um QR Code novo."}
                  </p>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={handleLoadQrCode}
                disabled={qrLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} />
                <span>{qrLoading ? "A gerar..." : "Gerar / Atualizar QR Code"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Test Send Section */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Testar Envio de Mensagem WhatsApp
            </h3>
            <p className="text-xs text-slate-500">
              Certifique-se de que a mensagem chega corretamente antes de ativar as notificações para os clientes.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-lg text-xs ${
                testResult.success
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {testResult.message}
            </div>
          )}

          <form onSubmit={handleSendTestMessage} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="Número de teste (ex: 841234567 ou +258841234567)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={testSending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{testSending ? "A enviar..." : "Enviar Teste"}</span>
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
