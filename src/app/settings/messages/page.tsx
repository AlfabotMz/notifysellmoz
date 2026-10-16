"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  Info,
  Sparkles,
  Check,
} from "lucide-react";
import { ALLOWED_VARIABLES } from "@/lib/templates/renderer";

export default function MessageTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("ORDER_CONFIRMATION");
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const templateTypes = [
    {
      id: "ORDER_CONFIRMATION",
      title: "Confirmação ao Cliente (Contra Entrega)",
      badge: "Cliente",
      desc: "Enviado logo após a criação da encomenda, informando o valor a pagar na entrega.",
    },
    {
      id: "DELIVERY_ASSIGNED",
      title: "Nova Encomenda para o Entregador",
      badge: "Entregador",
      desc: "Enviado ao estafeta com o endereço, itens e valor a cobrar.",
    },
    {
      id: "OWNER_ALERT",
      title: "Alerta de Venda ao Proprietário",
      badge: "Proprietário",
      desc: "Resumo da nova venda para o dono da loja.",
    },
    {
      id: "ORDER_CANCELLED",
      title: "Notificação de Cancelamento",
      badge: "Entregador / Cliente",
      desc: "Informa sobre o cancelamento de uma entrega atribuída.",
    },
    {
      id: "PROCESSING_FAILURE",
      title: "Alerta de Revisão Manual (Sem Telefone)",
      badge: "Alerta Interno",
      desc: "Enviado ao proprietário quando a encomenda não possui telefone válido.",
    },
  ];

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/settings/messages");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || {});
        setPreviews(data.previews || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleTemplateChange = (val: string) => {
    setTemplates((prev) => ({
      ...prev,
      [selectedTemplate]: val,
    }));
  };

  const insertVariable = (varName: string) => {
    const snippet = `{{${varName}}}`;
    const current = templates[selectedTemplate] || "";
    handleTemplateChange(`${current} ${snippet} `);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({ type: "success", text: "Modelos de mensagem guardados com sucesso!" });
      fetchTemplates();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Modelos de Mensagem WhatsApp
          </h1>
          <p className="text-sm text-slate-500">
            Personalize os textos enviados automaticamente aos clientes e à equipa de logística.
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

        {/* Cash on Delivery Notice */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Regra de Pagamento Contra Entrega:</strong> A mensagem de confirmação ao cliente deve sempre esclarecer que a encomenda foi registada e que o montante será liquidado no ato da entrega. Não afirme que a encomenda já foi paga.
          </div>
        </div>

        {/* Template Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templateTypes.map((t) => {
            const isSelected = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`p-4 rounded-xl text-left border transition-all ${
                  isSelected
                    ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {t.badge}
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">{t.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{t.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Editor and Preview Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Column */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Editor de Texto</h3>
              <span className="text-xs text-slate-400 font-mono">
                {templates[selectedTemplate]?.length || 0} caracteres
              </span>
            </div>

            {/* Variable Insertion Chips */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                Clique numa variável para inserir no texto:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALLOWED_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded text-xs font-mono transition-colors"
                  >
                    &#123;&#123;{v}&#125;&#125;
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={12}
              value={templates[selectedTemplate] || ""}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
            />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 shadow-sm"
              >
                {saving ? "A guardar..." : "Guardar Todos os Modelos"}
              </button>
            </div>
          </div>

          {/* Live WhatsApp Preview Column */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Pré-visualização (Dados de Exemplo Moçambique)
              </h3>
            </div>

            {/* WhatsApp Chat Simulation Bubble */}
            <div className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl p-4 flex flex-col justify-end">
              <div className="max-w-[88%] bg-white rounded-2xl rounded-bl-xs p-4 shadow-sm border border-slate-200/60 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed relative">
                {previews[selectedTemplate] || templates[selectedTemplate] || "Sem conteúdo"}
                <div className="text-[10px] text-slate-400 text-right mt-2 flex items-center justify-end gap-1">
                  <span>14:32</span>
                  <span className="text-emerald-600">✓✓</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3">
              Exemplo gerado com dados simulados de Moçambique (moeda MZN, endereço em Maputo).
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
