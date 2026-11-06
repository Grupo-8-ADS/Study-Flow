"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, CircleHelp, FileText, LogOut, Settings, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { limparAgenda } from "@/lib/agenda";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Alert, PageLoading } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

type UserSession = {
  email: string;
  nome: string;
  username: string;
  avatar_url?: string | null;
};

type PrivacySettings = {
  allowSharing: boolean;
  publicProfile: boolean;
  showAchievements: boolean;
  showStudyHours: boolean;
};

const defaultPrivacy: PrivacySettings = {
  allowSharing: true,
  publicProfile: false,
  showAchievements: true,
  showStudyHours: true,
};

const faqItems = [
  ["Como adicionar uma disciplina?", "Em Disciplinas, use Adicionar disciplina e informe o nome, o professor e as avaliações."],
  ["Como funciona o Timer Pomodoro?", "Escolha o período de foco ou pausa, selecione uma disciplina e inicie o cronômetro."],
  ["Como as horas estudadas são registradas?", "As sessões concluídas serão usadas para alimentar seu histórico e a página de Estatísticas."],
  ["Como desbloquear conquistas?", "Conclua sessões, mantenha sequências de estudo e alcance metas relacionadas às disciplinas."],
  ["Como compartilhar meu progresso?", "Na página de Estatísticas, use o botão Compartilhar progresso para copiar um resumo."],
  ["Como excluir minha conta?", "Em Conta › Preferências, use Excluir minha conta e confirme no aviso de segurança. A conta e todos os seus dados são apagados de forma permanente."],
];

export function ConfiguracoesView({ basic = false }: { basic?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacy);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      const storedSession = localStorage.getItem("studyflow_session");

      if (!storedSession) {
        router.push("/");
        return;
      }

      try {
        const parsedSession = JSON.parse(storedSession) as UserSession;
        setUser(parsedSession);

        const storedPrivacy = localStorage.getItem(`studyflow_privacy_${parsedSession.email}`);
        if (storedPrivacy) {
          setPrivacy(JSON.parse(storedPrivacy) as PrivacySettings);
        }

        const storedNotif = localStorage.getItem(`studyflow_notifications_${parsedSession.email}`);
        if (storedNotif !== null) {
          setNotificationsEnabled(JSON.parse(storedNotif));
        }

        // Se houver conexão com o Supabase, sincroniza preferência
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("recebe_notificacao_pref,avatar_url")
            .eq("id", userData.user.id)
            .maybeSingle();

          if (profile) {
            if (profile.recebe_notificacao_pref !== undefined) {
              setNotificationsEnabled(profile.recebe_notificacao_pref);
            }
            if (profile.avatar_url && !parsedSession.avatar_url) {
              setUser((curr) => curr ? { ...curr, avatar_url: profile.avatar_url } : null);
            }
          }
        }
      } catch {
        localStorage.removeItem("studyflow_session");
        limparAgenda();
        router.push("/");
      }
    }

    void loadConfig();
  }, [router]);

  const toggleNotifications = async () => {
    if (!user) return;
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem(`studyflow_notifications_${user.email}`, JSON.stringify(nextVal));

    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("profiles").update({ recebe_notificacao_pref: nextVal }).eq("id", data.user.id);
      }
    } catch {
      // offline fallback
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
    router.push("/");
  };

  const deleteAccount = async () => {
    if (!user || isDeleting) return;

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
    router.push("/");
  };

  const updatePrivacy = (key: keyof PrivacySettings) => {
    if (!user) return;

    setPrivacy((current) => {
      const next = { ...current, [key]: !current[key] };
      localStorage.setItem(`studyflow_privacy_${user.email}`, JSON.stringify(next));
      return next;
    });
  };

  if (!user) {
    return <PageLoading label="Carregando preferências..." />;
  }

  const isPresentationAccount =
    user.email.trim().toLowerCase() === "teste@teste.com" ||
    user.username.trim().toLowerCase() === "teste";

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
                {isPresentationAccount
                  ? "Esta é a conta de demonstração da apresentação. A exclusão foi bloqueada para manter os dados de exemplo disponíveis."
                  : "Apaga seu cadastro e todos os seus dados de forma permanente. Essa ação não pode ser desfeita."}
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
              Sua conta e todos os seus dados (disciplinas, sessões, conquistas e notificações) serão apagados de forma permanente e você
              precisará criar uma nova conta para voltar.
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
          description="Escolha quais informações poderão aparecer no seu perfil. As preferências são salvas automaticamente neste dispositivo."
          onClose={() => setShowPrivacy(false)}
          title="Configurações de privacidade"
          titleId="privacy-title"
        >
          <ul className="divide-y divide-line rounded-control border border-line">
            <PrivacyToggle
              checked={privacy.publicProfile}
              description="Permitir que outras pessoas visualizem seu perfil."
              label="Perfil público"
              onChange={() => updatePrivacy("publicProfile")}
            />
            <PrivacyToggle
              checked={privacy.showStudyHours}
              description="Mostrar o total de horas e seus resumos de estudo."
              label="Mostrar horas estudadas"
              onChange={() => updatePrivacy("showStudyHours")}
            />
            <PrivacyToggle
              checked={privacy.showAchievements}
              description="Exibir suas conquistas e evolução de nível."
              label="Mostrar conquistas"
              onChange={() => updatePrivacy("showAchievements")}
            />
            <PrivacyToggle
              checked={privacy.allowSharing}
              description="Habilitar os botões para compartilhar seu progresso."
              label="Permitir compartilhamentos"
              onChange={() => updatePrivacy("allowSharing")}
            />
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
            {faqItems.map(([question, answer], index) => {
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
            <p className="font-medium text-ink-800">O Study Flow é uma ferramenta desenvolvida com finalidade acadêmica e de produtividade pessoal.</p>
            <section>
              <h3 className="font-semibold text-ink-900">1. Uso individual</h3>
              <p>Os dados e horários armazenados são de uso estritamente individual do estudante para fins de organização acadêmica.</p>
            </section>
            <section>
              <h3 className="font-semibold text-ink-900">2. Privacidade e dados</h3>
              <p>O aplicativo respeita sua privacidade e não compartilha dados confidenciais ou de rotina com terceiros.</p>
            </section>
            <section>
              <h3 className="font-semibold text-ink-900">3. Responsabilidade</h3>
              <p>
                O usuário é responsável pela veracidade dos dados cadastrados e conformidade de sua rotina de estudos com seus compromissos
                institucionais.
              </p>
            </section>
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

function Switch({ checked, labelledBy, onChange }: { checked: boolean; labelledBy?: string; onChange: () => void }) {
  return (
    <button
      aria-checked={checked}
      aria-labelledby={labelledBy}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary-700" : "bg-ink-300"}`}
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
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
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
      <Switch checked={checked} labelledBy={id} onChange={onChange} />
    </li>
  );
}

export default function ConfiguracoesPage() {
  return <ConfiguracoesView />;
}
