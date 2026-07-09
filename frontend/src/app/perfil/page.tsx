"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Check,
  Eye,
  EyeOff,
  Gift,
  LayoutDashboard,
  Lock,
  LogOut,
  Pencil,
  Settings,
  Timer,
  Upload,
  User,
  X,
} from "lucide-react";

type UserSession = {
  email: string;
  nome: string;
  username: string;
};

type ProfileData = {
  name: string;
  username: string;
  email: string;
  bgColor: string;
  level: string;
  xp: string;
  lastAchievement: string;
};

type EditableProfileField = "name" | "username" | "email" | "bgColor" | "level" | "xp" | "lastAchievement";

type PasswordData = {
  newPassword: string;
  confirmPassword: string;
  emailCode: string;
};

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendário", href: "/calendario", icon: Calendar },
  { name: "Atividade", href: "/atividade", icon: Activity },
  { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
  { name: "Timer", href: "/timer", icon: Timer },
  { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  { name: "Recompensas", href: "/rewards", icon: Gift },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

const fallbackUser: UserSession = {
  email: "joao@exemplo.com",
  nome: "João Silva",
  username: "joaosilva",
};

const defaultProfile: ProfileData = {
  name: fallbackUser.nome,
  username: fallbackUser.username,
  email: fallbackUser.email,
  bgColor: "#0F1C1D",
  level: "42",
  xp: "12.450",
  lastAchievement: "Mestre do Tempo",
};

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [editingField, setEditingField] = useState<EditableProfileField | null>(null);
  const [tempValues, setTempValues] = useState<Partial<ProfileData>>({});
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [bannerPic, setBannerPic] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const profilePicRef = useRef<HTMLInputElement>(null);
  const bannerPicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedSession = localStorage.getItem("studyflow_session");

    if (!storedSession) return;

    try {
      const parsedSession = JSON.parse(storedSession) as UserSession;
      setTimeout(() => {
        setProfile((current) => ({
          ...current,
          email: parsedSession.email,
          name: parsedSession.nome,
          username: parsedSession.username,
        }));
      }, 0);
    } catch {
      localStorage.removeItem("studyflow_session");
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

  const handleEditStart = (field: EditableProfileField) => {
    setEditingField(field);
    setTempValues({ [field]: profile[field] });
  };

  const handleEditConfirm = (field: EditableProfileField) => {
    const nextValue = tempValues[field];

    if (nextValue !== undefined) {
      setProfile((current) => ({ ...current, [field]: nextValue }));
    }

    setEditingField(null);
    setTempValues({});
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setTempValues({});
  };

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => setter(String(readerEvent.target?.result ?? ""));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!profile.username.trim()) nextErrors.username = "Nome de usuário não pode estar vazio.";
    if (!profile.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) nextErrors.email = "Formato de email inválido.";
    if (!currentPassword) nextErrors.currentPassword = "Senha atual é obrigatória para salvar.";

    return nextErrors;
  };

  const handleSave = () => {
    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const renderField = (
    label: string,
    fieldKey: EditableProfileField,
    type: "text" | "email" = "text",
    editable = true,
  ) => {
    const isEditing = editingField === fieldKey;
    const error = errors[fieldKey];

    return (
      <div className="flex flex-col gap-3 border-b border-[#e6eeec] py-4 last:border-b-0 sm:flex-row sm:items-center">
        <span className="w-44 shrink-0 text-sm font-semibold text-gray-500">{label}</span>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                autoFocus
                className="min-h-11 flex-1 rounded-xl border border-[#29645e] bg-white px-3 text-gray-900 outline-none ring-[#29645e]/10 transition focus:ring-4"
                onChange={(event) => setTempValues((current) => ({ ...current, [fieldKey]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleEditConfirm(fieldKey);
                  if (event.key === "Escape") handleEditCancel();
                }}
                type={type}
                value={tempValues[fieldKey] ?? profile[fieldKey]}
              />
              <button
                className="rounded-xl bg-[#29645e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f514c]"
                onClick={() => handleEditConfirm(fieldKey)}
                type="button"
              >
                OK
              </button>
              <button
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                onClick={handleEditCancel}
                type="button"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <span className="break-words text-base font-medium text-gray-900">{profile[fieldKey]}</span>
          )}
          {error ? <p className="mt-1 text-xs font-medium text-red-500">{error}</p> : null}
        </div>
        {editable && !isEditing ? (
          <button
            aria-label={`Editar ${label}`}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-400 transition hover:bg-[#edf5f3] hover:text-[#29645e]"
            onClick={() => handleEditStart(fieldKey)}
            type="button"
          >
            <Pencil size={17} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7fdfd] font-[Roboto] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col justify-between bg-[#29645e] px-4 py-6 text-white shadow-lg lg:min-h-screen lg:w-[260px]">
        <div className="flex flex-col gap-8">
          <h1 className="px-2 font-['Rubik_Bubbles'] text-2xl font-normal tracking-wider">Study Flow</h1>

          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  className="flex shrink-0 cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium text-gray-100 transition duration-200 hover:bg-[#347871] hover:text-white lg:w-full"
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  type="button"
                >
                  <Icon className="shrink-0" size={20} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          className="mt-8 flex w-full cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium text-red-200 transition duration-200 hover:bg-[#a83232] hover:text-white"
          onClick={logout}
          type="button"
        >
          <LogOut className="shrink-0" size={20} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
        <header className="relative flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Conta</p>
            <h2 className="text-2xl font-bold text-gray-800 lg:text-3xl">Configurações do Perfil</h2>
          </div>

          <div className="relative flex items-center gap-4">
            <button
              aria-label="Abrir notificações"
              className="relative cursor-pointer rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm transition hover:bg-[#eaf6f4] hover:text-[#29645e]"
              onClick={() => setShowNotifications((current) => !current)}
              type="button"
            >
              <Bell size={20} />
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            </button>

            {showNotifications ? (
              <div className="absolute right-12 top-12 z-40 w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl">
                <p className="font-semibold text-gray-700">Notificações</p>
                <p className="mt-2 text-sm leading-6 text-gray-500">Você não possui novas notificações de perfil.</p>
              </div>
            ) : null}

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-[#eaf6f4] text-[#29645e] shadow-sm">
              <User size={22} />
            </div>
          </div>
        </header>

        <div className="mx-auto mt-7 w-full max-w-6xl">
          <section className="overflow-hidden rounded-[28px] border border-[#dcecea] bg-white shadow-[0_8px_30px_rgba(41,100,94,0.06)]">
            <div className="relative min-h-48 overflow-hidden sm:min-h-56">
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${profile.bgColor} 0%, #29655E 100%)` }}
              />
              <div className="absolute inset-0 bg-[#0f1c1d]/55" />

              <div className="relative z-10 flex h-full min-h-48 items-center gap-5 p-6 sm:min-h-56 sm:p-8">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[28px] bg-gray-300 ring-4 ring-white/20 sm:h-32 sm:w-32">
                  {profilePic ? (
                    <img alt="Foto do perfil" className="h-full w-full object-cover" src={profilePic} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#eaf6f4] text-4xl font-bold text-[#29645e]">
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-white">
                  <p className="truncate text-xl font-semibold">@{profile.username}</p>
                  <p className="mt-1 text-sm text-white/80">
                    Nível {profile.level} &nbsp;•&nbsp; {profile.xp} XP
                  </p>
                  <p className="mt-1 text-sm text-white/75">🏆 {profile.lastAchievement}</p>
                </div>

                <div className="ml-auto hidden w-72 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10 sm:block">
                  {bannerPic ? (
                    <img alt="Preview do banner" className="h-36 w-full object-cover" src={bannerPic} />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-white/10 text-sm font-semibold text-white/80">
                      Preview do banner
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <section className="rounded-[24px] border border-[#e1ecea] bg-[#f8fbfa] p-5 sm:p-6">
                {renderField("Nome", "name", "text", false)}
                {renderField("Nome de usuário", "username")}
                {renderField("Email", "email", "email")}

                <div className="flex flex-col gap-3 border-b border-[#e6eeec] py-4 last:border-b-0 sm:flex-row sm:items-center">
                  <span className="w-44 shrink-0 text-sm font-semibold text-gray-500">Senha</span>
                  <span className="min-w-0 flex-1 tracking-[0.18em] text-gray-900">••••••••</span>
                  <button
                    aria-label="Alterar senha"
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-400 transition hover:bg-[#edf5f3] hover:text-[#29645e]"
                    onClick={() => setPasswordModalOpen(true)}
                    type="button"
                  >
                    <Lock size={17} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <span className="w-44 shrink-0 text-sm font-semibold text-gray-500">Cor de fundo</span>
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <span
                      className="h-8 w-12 rounded-xl border border-gray-200"
                      style={{ backgroundColor: profile.bgColor }}
                    />
                    <span className="font-mono text-sm text-gray-700">{profile.bgColor}</span>
                    <input
                      className="sr-only"
                      onChange={(event) => setProfile((current) => ({ ...current, bgColor: event.target.value }))}
                      type="color"
                      value={profile.bgColor}
                    />
                  </label>
                </div>
              </section>

              <section className="mt-6 grid gap-5 sm:grid-cols-2">
                <UploadCard
                  buttonLabel="Enviar nova foto"
                  inputRef={profilePicRef}
                  onChange={(event) => handleImageChange(event, setProfilePic)}
                  preview={profilePic}
                  title="Foto de Perfil"
                />
                <UploadCard
                  buttonLabel="Enviar novo banner"
                  inputRef={bannerPicRef}
                  onChange={(event) => handleImageChange(event, setBannerPic)}
                  preview={bannerPic}
                  title="Banner"
                />
              </section>

              <section className="mt-8 border-t border-[#e6eeec] pt-8">
                <div className="mx-auto flex max-w-md flex-col gap-4">
                  <label className="text-sm font-semibold text-gray-700">
                    Digite sua senha atual para confirmar as alterações
                  </label>
                  <div className="relative">
                    <input
                      className={`min-h-12 w-full rounded-2xl border bg-[#f8fbfa] px-4 pr-12 text-gray-900 outline-none transition focus:border-[#29645e] focus:ring-4 focus:ring-[#29645e]/10 ${
                        errors.currentPassword ? "border-red-500" : "border-gray-200"
                      }`}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Senha atual"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                    />
                    <button
                      aria-label="Alternar visibilidade da senha"
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                      onClick={() => setShowCurrentPassword((current) => !current)}
                      type="button"
                    >
                      {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.currentPassword ? <p className="text-xs font-medium text-red-500">{errors.currentPassword}</p> : null}

                  <div className="flex flex-col items-center gap-4 pt-2">
                    <button
                      className="w-full cursor-pointer rounded-[22px] bg-[#29645e] px-8 py-3 text-lg font-semibold text-white shadow-md shadow-[#29645e]/15 transition hover:bg-[#1f514c] sm:w-auto"
                      onClick={handleSave}
                      type="button"
                    >
                      Salvar Alterações
                    </button>

                    {saveSuccess ? (
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#29645e]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#29645e] text-white">
                          <Check size={14} />
                        </span>
                        Alterações salvas com sucesso!
                      </span>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSave={() => undefined}
      />
    </div>
  );
}

function UploadCard({
  buttonLabel,
  inputRef,
  onChange,
  preview,
  title,
}: {
  buttonLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  preview: string | null;
  title: string;
}) {
  return (
    <article className="flex flex-col gap-3">
      <h3 className="font-semibold text-gray-700">{title}</h3>
      <div className="aspect-video overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
        {preview ? (
          <img alt={`Preview de ${title}`} className="h-full w-full object-cover" src={preview} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#edf5f3] text-sm font-semibold text-[#5f8d87]">
            Sem imagem enviada
          </div>
        )}
      </div>
      <input ref={inputRef} accept="image/*" className="hidden" onChange={onChange} type="file" />
      <button
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#29645e] bg-white px-4 py-3 text-sm font-semibold text-[#29645e] transition hover:bg-[#edf5f3]"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <Upload size={17} />
        {buttonLabel}
      </button>
    </article>
  );
}

function PasswordModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PasswordData) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSave = () => {
    if (!newPassword) {
      setError("Nova senha é obrigatória.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!emailCode) {
      setError("Código de verificação é obrigatório.");
      return;
    }

    setError("");
    onSave({ newPassword, confirmPassword, emailCode });
    setNewPassword("");
    setConfirmPassword("");
    setEmailCode("");
    onClose();
  };

  const handleClose = () => {
    setError("");
    setNewPassword("");
    setConfirmPassword("");
    setEmailCode("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="password-modal-title"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <h2 className="text-2xl font-semibold text-gray-900" id="password-modal-title">
            Alterar Senha
          </h2>
          <button
            aria-label="Fechar modal"
            className="cursor-pointer rounded-xl p-2 text-gray-500 transition hover:bg-gray-100"
            onClick={handleClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex flex-col gap-5 p-6">
          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-500">{error}</p> : null}

          <PasswordInput
            label="Nova Senha"
            onChange={setNewPassword}
            onToggle={() => setShowNew((current) => !current)}
            placeholder="Digite a nova senha"
            show={showNew}
            value={newPassword}
          />
          <PasswordInput
            label="Confirmar Senha"
            onChange={setConfirmPassword}
            onToggle={() => setShowConfirm((current) => !current)}
            placeholder="Confirme a nova senha"
            show={showConfirm}
            value={confirmPassword}
          />

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">Código de Verificação por Email</span>
            <input
              className="min-h-12 rounded-2xl border border-gray-200 bg-[#f8fbfa] px-4 text-gray-900 outline-none transition focus:border-[#29645e] focus:ring-4 focus:ring-[#29645e]/10"
              onChange={(event) => setEmailCode(event.target.value)}
              placeholder="Digite o código recebido"
              type="text"
              value={emailCode}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
              onClick={handleClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="cursor-pointer rounded-2xl bg-[#29645e] px-4 py-3 font-semibold text-white transition hover:bg-[#1f514c]"
              onClick={handleSave}
              type="button"
            >
              Salvar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PasswordInput({
  label,
  onChange,
  onToggle,
  placeholder,
  show,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
  show: boolean;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <div className="relative">
        <input
          className="min-h-12 w-full rounded-2xl border border-gray-200 bg-[#f8fbfa] px-4 pr-12 text-gray-900 outline-none transition focus:border-[#29645e] focus:ring-4 focus:ring-[#29645e]/10"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={show ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={`Alternar visibilidade de ${label}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
          onClick={onToggle}
          type="button"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </label>
  );
}
