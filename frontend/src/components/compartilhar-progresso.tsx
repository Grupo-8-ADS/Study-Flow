/**
 * Compartilhar progresso (RF007): mostra o texto que será enviado e deixa escolher como
 * — copiar, WhatsApp, X ou o menu de compartilhamento do aparelho. O feedback mostra o que
 * de fato aconteceu (antes, o botão dizia "Resumo copiado" mesmo quando nada era copiado).
 * @packageDocumentation
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Share2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";

/** Copia texto; usa execCommand quando a API de clipboard não existe ou é bloqueada (http, iframe). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Cai para o método antigo abaixo.
  }
  try {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    campo.remove();
    return ok;
  } catch {
    return false;
  }
}

/** O navegador tem menu de compartilhamento nativo para texto (celulares, Safari, Edge...). */
const temCompartilhamentoNativo = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function" && (navigator.canShare?.({ text: "x" }) ?? true);

type Resultado = { tom: "success" | "danger"; mensagem: string } | null;

export function CompartilharProgressoModal({
  texto,
  permitido,
  erroPrivacidade = null,
  onTentarDeNovo,
  onClose,
}: {
  texto: string;
  permitido: boolean;
  /** Preferências de privacidade não lidas: o compartilhamento fica bloqueado até ler. */
  erroPrivacidade?: string | null;
  onTentarDeNovo?: () => void;
  onClose: () => void;
}) {
  const [resultado, setResultado] = useState<Resultado>(null);
  const [copiado, setCopiado] = useState(false);
  const textoUrl = encodeURIComponent(texto);

  const copiar = async () => {
    const ok = await copiarTexto(texto);
    setCopiado(ok);
    setResultado(ok ? { tom: "success", mensagem: "Texto copiado. Agora é só colar onde quiser." } : { tom: "danger", mensagem: "Não foi possível copiar. Selecione o texto acima e copie manualmente." });
  };

  const compartilharNativo = async () => {
    try {
      await navigator.share({ title: "Study Flow", text: texto });
      setResultado({ tom: "success", mensagem: "Progresso compartilhado!" });
    } catch (error) {
      // Fechar o menu sem escolher nada não é erro.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setResultado({ tom: "danger", mensagem: "O compartilhamento do aparelho falhou. Use Copiar texto ou um dos atalhos." });
    }
  };

  return (
    <Modal
      footer={
        <Button onClick={onClose} variant="secondary">
          Fechar
        </Button>
      }
      onClose={onClose}
      title="Compartilhar progresso"
    >
      {permitido ? (
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-ink-700">Texto que será compartilhado</span>
            <textarea
              className="min-h-24 resize-none rounded-control border border-line bg-ink-50/60 p-3 text-ink-800"
              onFocus={(e) => e.currentTarget.select()}
              readOnly
              value={texto}
            />
          </label>

          {resultado ? (
            <Alert role="status" tone={resultado.tom}>
              {resultado.mensagem}
            </Alert>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => void copiar()}>
              {copiado ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} />}
              {copiado ? "Copiado" : "Copiar texto"}
            </Button>
            {temCompartilhamentoNativo() ? (
              <Button onClick={() => void compartilharNativo()} variant="secondary">
                <Share2 aria-hidden size={18} />
                Mais opções
              </Button>
            ) : null}
            <a className={buttonClass("secondary")} href={`https://wa.me/?text=${textoUrl}`} rel="noopener noreferrer" target="_blank">
              WhatsApp
            </a>
            <a className={buttonClass("secondary")} href={`https://twitter.com/intent/tweet?text=${textoUrl}`} rel="noopener noreferrer" target="_blank">
              X (Twitter)
            </a>
          </div>
        </div>
      ) : erroPrivacidade ? (
        <div className="grid gap-3 text-sm text-ink-600">
          <Alert tone="danger">{erroPrivacidade}</Alert>
          {onTentarDeNovo ? (
            <Button className="w-fit" onClick={onTentarDeNovo} variant="secondary">
              Tentar de novo
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 text-sm text-ink-600">
          <p>O compartilhamento está desativado nas suas configurações de privacidade.</p>
          <Link className={buttonClass("secondary", "md", "w-fit")} href="/configuracoes">
            Abrir configurações
          </Link>
        </div>
      )}
    </Modal>
  );
}
