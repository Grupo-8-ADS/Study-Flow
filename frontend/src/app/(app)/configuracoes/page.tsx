"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, CircleHelp, FileText, LogOut, Settings, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { limparAgenda } from "@/lib/agenda";
import { limparConsultas } from "@/lib/consultas";
import { atualizarPerfilEmCache, usePerfil } from "@/lib/perfil";
import {
  FAQ,
  OPCOES_PRIVACIDADE,
  PRIVACIDADE_PADRAO,
  TERMOS_SERVICO,
  TEXTO_EXCLUIR_CONTA,
  ERRO_CARREGAR_PRIVACIDADE,
  alternarPrivacidadeLida,
  contaDemonstracao,
  privacidadeEfetiva,
  type ChavePrivacidade,
  type Privacidade,
} from "@studyflow/shared";
import { carregarPrivacidadeUsuario, gravarPrivacidadeUsuario } from "@/lib/privacidade";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Alert, PageLoading } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

export function ConfiguracoesView({ basic = false }: { basic?: boolean }) {
  const router = useRouter();
  const { dados: perfil, erro: erroPerfil } = usePerfil();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [privacy, setPrivacy] = useState<Privacidade>({ ...PRIVACIDADE_PADRAO });
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [salvandoNotificacoes, setSalvandoNotificacoes] = useState(false);
  const [erroNotificacoes, setErroNotificacoes] = useState<string | null>(null);

  const userId = perfil?.id ?? null;
  const email = perfil?.email ?? null;
  const notificationsEnabled = perfil?.recebe_notificacao_pref ?? true;

  useEffect(() => {
    if (!userId || !email) return;
    let ativo = true;
    void carregarPrivacidadeUsuario(userId, email).then((lida) => {
      if (!ativo) return;
      setPrivacy(lida.privacidade);
      setPrivacyLoaded(lida.carregada);
    });
    return () => {
      ativo = false;
    };
  }, [userId, email]);

  const toggleNotifications = async () => {
    if (!perfil || salvandoNotificacoes) return;
    const nextVal = !notificationsEnabled;
    setErroNotificacoes(null);
    setSalvandoNotificacoes(true);
    // Muda na hora e desfaz se o banco recusar.
    atualizarPerfilEmCache({ recebe_notificacao_pref: nextVal });
    const { error } = await supabase.from("profiles").update({ recebe_notificacao_pref: nextVal }).eq("id", perfil.id);
    setSalvandoNotificacoes(false);
    if (error) {
      atualizarPerfilEmCache({ recebe_notificacao_pref: !nextVal });
      setErroNotificacoes("Não foi possível salvar a preferência de notificações.");
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora se offline
    }
    localStorage.removeItem("studyflow_session");
    limparAgenda();
    limparConsultas();
    router.push("/");
  };

  const deleteAccount = async () => {
    if (!perfil || isDeleting) return;

    setDeleteError("");
    setIsDeleting(true);

    // RNF001: com usuário no Supabase, a função do banco apaga a conta e todos os dados dele.
    const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (data.user) {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) {
        setDeleteError(`Não foi possível excluir a conta: ${error.message}`);
        setIsDeleting(false);
        return;
      }
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // A conta já foi removida; ignora erro de rede no logout
    }

    // Limpa a sessão e todos os caches locais do app.
    Object.keys(localStorage)
      .filter((key) => key.startsWith("studyflow_"))
      .forEach((key) => localStorage.removeItem(key));
    limparAgenda();
    limparConsultas();
    router.push("/");
  };

  /** Lê a privacidade; se falhar, a tela fica em modo privado e não grava nada. */
  async function loadPrivacy(id: string | null, email: string) {
    const lida = await carregarPrivacidadeUsuario(id, email);
    setPrivacy(lida.privacidade);
    setPrivacyLoaded(lida.carregada);
  }

  const updatePrivacy = async (key: ChavePrivacidade) => {
    const anterior = privacy;
    // Sem as preferências reais lidas, não grava (seriam os padrões por cima da escolha do usuário).
    const next = alternarPrivacidadeLida({ privacidade: anterior, carregada: privacyLoaded }, key);
    if (!next) return;
    setPrivacy(next);
    setPrivacyError(null);
    const erro = await gravarPrivacidadeUsuario(userId, next);
    if (erro) {
      setPrivacy(anterior);
      setPrivacyError(erro);
    }
  };

  if (!perfil) {
    return erroPerfil ? <Alert tone="danger">{erroPerfil}</Alert> : <PageLoading label="Carregando preferências..." />;
  }
  const user = perfil;

  const isPresentationAccount = contaDemonstracao(user);

  return (
    <>
      <PageHeader title="Preferências" />

      <div className="grid max-w-4xl gap-6">
        <Card aria-labelledby="titulo-conta">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-700 text-2xl font-semibold text-white">
              {user.avatar_url ? (
                <img alt="" className="h-full w-full object-cover" src={user.avatar_url} />
              ) : (
                user.nome.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-ink-900" id="titulo-conta">
                {user.nome}
              </h2>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-ink-500">Usuário</dt>
                <dd className="font-medium text-ink-800">@{user.username}</dd>
                <dt className="text-ink-500">E-mail</dt>
                <dd className="truncate font-medium text-ink-800">{user.email}</dd>
              </dl>
            </div>
            <Button onClick={() => router.push("/perfil")} variant="secondary">
              Editar perfil
            </Button>
          </div>
        </Card>

        <Card aria-labelledby="titulo-geral" padded={false}>
          <div className="p-5 pb-2 sm:p-6 sm:pb-2">
            <CardHeader icon={<Settings size={18} />} id="titulo-geral" title="Geral" />
          </div>
          <ul className="divide-y divide-line border-t border-line">
            <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
              <RowIcon>
                <Bell size={18} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900" id="notif-label">
                  Notificações e lembretes
                </p>
                <p className="text-sm text-ink-500">Avisos de sessões de estudo, provas e entregas.</p>
              </div>
              <Switch checked={notificationsEnabled} labelledBy="notif-label" onChange={toggleNotifications} />
            </li>
            {erroNotificacoes ? (
              <li className="px-5 py-3 sm:px-6">
                <Alert tone="danger">{erroNotificacoes}</Alert>
              </li>
            ) : null}
            <SettingsRow
              disabled={basic}
              icon={<ShieldCheck size={18} />}
              label="Configurações de privacidade"
              onClick={() => setShowPrivacy(true)}
            />
            <SettingsRow
              disabled={basic}
              icon={<CircleHelp size={18} />}
              label="Ajuda e FAQ"
              onClick={() => setShowFaq(true)}
            />
            <SettingsRow
              disabled={basic}
              icon={<FileText size={18} />}
              label="Termos de Serviço"
              onClick={() => setShowTerms(true)}
            />
            <SettingsRow
              icon={<LogOut size={18} />}
              label="Sair da conta"
              onClick={logout}
            />
          </ul>
        </Card>

        <Card aria-labelledby="titulo-risco" className="!border-danger/25">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-ink-900" id="titulo-risco">
                Excluir conta
              </h2>
              <p className="mt-1 max-w-xl text-sm text-ink-500">
                {isPresentationAccount ? TEXTO_EXCLUIR_CONTA.avisoDemonstracao : TEXTO_EXCLUIR_CONTA.aviso}
              </p>
            </div>
            <Button
              disabled={isPresentationAccount}
              onClick={() => {
                setDeleteError("");
                setShowDeleteModal(true);
              }}
              variant="danger"
            >
              <Trash2 aria-hidden size={16} />
              {isPresentationAccount ? "Conta demo protegida" : "Excluir minha conta"}
            </Button>
          </div>
        </Card>
      </div>

      {showDeleteModal ? (
        <Modal
          footer={
            <>
              <Button onClick={() => setShowDeleteModal(false)} variant="secondary">
                Manter conta
              </Button>
              <Button disabled={isDeleting} onClick={() => void deleteAccount()} variant="danger">
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </Button>
            </>
          }
          onClose={() => setShowDeleteModal(false)}
          size="sm"
          title="Tem certeza?"
          titleId="delete-account-title"
        >
          <div className="flex gap-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <TriangleAlert size={20} />
            </span>
            <p className="text-sm leading-6 text-ink-600" id="delete-account-description">
              {TEXTO_EXCLUIR_CONTA.confirmacao}
            </p>
          </div>
          {deleteError ? (
            <Alert className="mt-4" tone="danger">
              {deleteError}
            </Alert>
          ) : null}
        </Modal>
      ) : null}

      {showPrivacy ? (
        <Modal
          description="Escolha quais informações poderão aparecer no seu perfil. As preferências são salvas na sua conta e valem no site e no app."
          onClose={() => setShowPrivacy(false)}
          title="Configurações de privacidade"
          titleId="privacy-title"
        >
          {!privacyLoaded ? (
            <Alert className="mb-3" tone="danger">
              {ERRO_CARREGAR_PRIVACIDADE}{" "}
              <button className="font-semibold underline underline-offset-2" onClick={() => void loadPrivacy(userId, user.email)} type="button">
                Tentar de novo
              </button>
            </Alert>
          ) : null}
          {privacyError ? (
            <Alert className="mb-3" tone="danger">
              {privacyError}
            </Alert>
          ) : null}
          <ul className="divide-y divide-line rounded-control border border-line">
            {OPCOES_PRIVACIDADE.map((opcao) => (
              <PrivacyToggle
                checked={privacidadeEfetiva({ privacidade: privacy, carregada: privacyLoaded })[opcao.chave]}
                disabled={!privacyLoaded}
                description={opcao.descricao}
                key={opcao.chave}
                label={opcao.titulo}
                onChange={() => void updatePrivacy(opcao.chave)}
              />
            ))}
          </ul>
        </Modal>
      ) : null}

      {showFaq ? (
        <Modal
          onClose={() => setShowFaq(false)}
          size="lg"
          title="Ajuda e FAQ"
          titleId="faq-title"
        >
          <ul className="divide-y divide-line rounded-control border border-line">
            {FAQ.map(({ pergunta: question, resposta: answer }, index) => {
              const expanded = openFaq === index;
              return (
                <li key={question}>
                  <button
                    aria-controls={`faq-${index}`}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium text-ink-900 hover:bg-ink-50"
                    onClick={() => setOpenFaq(expanded ? null : index)}
                    type="button"
                  >
                    {question}
                    <ChevronRight aria-hidden className={`shrink-0 text-ink-400 transition-transform ${expanded ? "rotate-90" : ""}`} size={18} />
                  </button>
                  {expanded ? (
                    <p className="px-4 pb-4 text-sm leading-6 text-ink-600" id={`faq-${index}`}>
                      {answer}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Modal>
      ) : null}

      {showTerms ? (
        <Modal
          footer={<Button onClick={() => setShowTerms(false)}>Entendido</Button>}
          onClose={() => setShowTerms(false)}
          title="Termos de Serviço"
          titleId="terms-title"
        >
          <div className="flex flex-col gap-4 text-sm leading-6 text-ink-600">
            <p className="font-medium text-ink-800">{TERMOS_SERVICO.introducao}</p>
            {TERMOS_SERVICO.secoes.map((secao) => (
              <section key={secao.titulo}>
                <h3 className="font-semibold text-ink-900">{secao.titulo}</h3>
                <p>{secao.texto}</p>
              </section>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-50 text-primary-700">
      {children}
    </span>
  );
}

function SettingsRow({
  description,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  description?: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors enabled:hover:bg-ink-50 disabled:cursor-default sm:px-6"
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <RowIcon>{icon}</RowIcon>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink-900">{label}</span>
          {description ? <span className="block text-sm text-ink-500">{description}</span> : null}
        </span>
        {disabled ? (
          <Badge>Em breve</Badge>
        ) : (
          <ChevronRight aria-hidden className="text-ink-400 transition-transform group-hover:translate-x-0.5" size={18} />
        )}
      </button>
    </li>
  );
}

function Switch({ checked, disabled = false, labelledBy, onChange }: { checked: boolean; disabled?: boolean; labelledBy?: string; onChange: () => void }) {
  return (
    <button
      aria-checked={checked}
      aria-labelledby={labelledBy}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-primary-700" : "bg-ink-300"}`}
      disabled={disabled}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function PrivacyToggle({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  const id = `privacy-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <li className="flex items-center gap-4 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink-900" id={id}>
          {label}
        </span>
        <span className="block text-sm text-ink-500">{description}</span>
      </span>
      <Switch checked={checked} disabled={disabled} labelledBy={id} onChange={onChange} />
    </li>
  );
}

export default function ConfiguracoesPage() {
  return <ConfiguracoesView />;
}
