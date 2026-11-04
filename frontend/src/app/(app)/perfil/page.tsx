"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ImageIcon, KeyRound, Pencil, Trophy, Upload, UserRound } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { progressoNivel } from "@studyflow/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

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
  level: "1",
  xp: "0",
  lastAchievement: "Foco inicial",
};

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [editingField, setEditingField] = useState<EditableProfileField | null>(null);
  const [tempValues, setTempValues] = useState<Partial<ProfileData>>({});
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [bannerPic, setBannerPic] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const profilePicRef = useRef<HTMLInputElement>(null);
  const bannerPicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const parsedSession = getStoredSession();

      if (!parsedSession) {
        router.push("/");
        return;
      }

      try {
        const currentUserId = await getCurrentSupabaseUserId(parsedSession);
        setSupabaseUserId(currentUserId);

        if (!currentUserId) {
          const localProfile = localStorage.getItem(`studyflow_profile_${parsedSession.email}`);
          if (localProfile) {
            setProfile(JSON.parse(localProfile));
          } else {
            setProfile((current) => ({
              ...current,
              email: parsedSession.email,
              name: parsedSession.nome,
              username: parsedSession.username,
            }));
          }
          return;
        }

        const { data: dbProfile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUserId)
          .maybeSingle();

        if (dbProfile && !error) {
          setProfile({
            name: dbProfile.nome || parsedSession.nome || "Usuário",
            username: dbProfile.username || parsedSession.username || "usuario",
            email: dbProfile.email || parsedSession.email,
            bgColor: dbProfile.bg_color || "#0F1C1D",
            level: String(dbProfile.nivel_atual ?? 1),
            xp: String(dbProfile.xp ?? 0),
            lastAchievement: dbProfile.last_achievement || "Foco inicial",
          });
          if (dbProfile.avatar_url) setProfilePic(dbProfile.avatar_url);
          if (dbProfile.banner_url) setBannerPic(dbProfile.banner_url);
        } else {
          setProfile((current) => ({
            ...current,
            email: parsedSession.email,
            name: parsedSession.nome,
            username: parsedSession.username,
          }));
        }
      } catch {
        // Fallback gracioso
      }
    }

    loadProfile();
  }, [router]);


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

    if (!profile.name.trim()) nextErrors.name = "Nome não pode estar vazio.";
    if (!profile.username.trim()) nextErrors.username = "Nome de usuário não pode estar vazio.";
    if (!profile.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) nextErrors.email = "Formato de email inválido.";

    return nextErrors;
  };

  const handleSave = async () => {
    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const session = getStoredSession();

      if (supabaseUserId && session) {
        if (currentPassword) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: session.email,
            password: currentPassword,
          });

          if (signInError) {
            setErrors({ currentPassword: "Senha atual incorreta." });
            setIsSaving(false);
            return;
          }
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            nome: profile.name,
            username: profile.username,
            email: profile.email,
            bg_color: profile.bgColor,
            avatar_url: profilePic,
            banner_url: bannerPic,
          })
          .eq("id", supabaseUserId);

        if (updateError) {
          setErrors({ global: "Erro ao salvar perfil no banco de dados." });
          setIsSaving(false);
          return;
        }

        if (profile.email !== session.email) {
          await supabase.auth.updateUser({ email: profile.email });
        }
      }

      // Atualiza localStorage
      if (session) {
        localStorage.setItem(
          "studyflow_session",
          JSON.stringify({
            ...session,
            email: profile.email,
            nome: profile.name,
            username: profile.username,
            avatar_url: profilePic,
            banner_url: bannerPic,
          })
        );
        localStorage.setItem(`studyflow_profile_${profile.email}`, JSON.stringify(profile));
      }

      setSaveSuccess(true);
      setCurrentPassword("");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setErrors({ global: "Ocorreu um erro ao processar as alterações." });
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (
    label: string,
    fieldKey: EditableProfileField,
    type: "text" | "email" = "text",
    editable = true,
  ) => {
    const isEditing = editingField === fieldKey;
    const error = errors[fieldKey];
    const inputId = `perfil-${fieldKey}`;

    return (
      <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
        <label className="w-40 shrink-0 text-sm text-ink-500" htmlFor={isEditing ? inputId : undefined}>
          {label}
        </label>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                aria-invalid={error ? true : undefined}
                autoFocus
                className="flex-1"
                id={inputId}
                onChange={(event) => setTempValues((current) => ({ ...current, [fieldKey]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleEditConfirm(fieldKey);
                  if (event.key === "Escape") handleEditCancel();
                }}
                type={type}
                value={tempValues[fieldKey] ?? profile[fieldKey]}
              />
              <div className="flex gap-2">
                <Button onClick={() => handleEditConfirm(fieldKey)} size="sm">
                  OK
                </Button>
                <Button onClick={handleEditCancel} size="sm" variant="secondary">
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <span className="break-words text-sm font-medium text-ink-900">{profile[fieldKey]}</span>
          )}
          {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : null}
        </div>
        {editable && !isEditing ? (
          <Button aria-label={`Editar ${label}`} className="self-end sm:self-auto" onClick={() => handleEditStart(fieldKey)} size="icon-sm" variant="ghost">
            <Pencil size={16} />
          </Button>
        ) : null}
      </div>
    );
  };

  const handlePasswordChange = async (data: PasswordData) => {
    try {
      if (supabaseUserId) {
        const { error } = await supabase.auth.updateUser({
          password: data.newPassword,
        });

        if (error) {
          setErrors({ global: `Erro ao alterar senha: ${error.message}` });
          return;
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setErrors({ global: "Erro ao atualizar senha." });
    }
  };

  const xpProgress = Math.round(progressoNivel(Number(profile.xp) || 0).progresso * 100);

  return (
    <>
      <PageHeader description="Como você aparece no Study Flow e os dados de acesso da conta." title="Perfil" />

      <div className="grid max-w-4xl gap-6">
        <Card className="overflow-hidden" padded={false}>
          <div className="relative h-32 sm:h-40">
            {bannerPic ? (
              <img alt="Banner do perfil" className="absolute inset-0 h-full w-full object-cover" src={bannerPic} />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${profile.bgColor} 0%, #29645e 100%)` }} />
            )}
            <Button className="absolute right-3 top-3" onClick={() => bannerPicRef.current?.click()} size="sm" variant="inverse">
              <ImageIcon aria-hidden size={15} />
              Alterar banner
            </Button>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6 sm:pb-6">
            <div className="relative -mt-12 h-24 w-24 shrink-0 sm:h-28 sm:w-28">
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-100 text-3xl font-semibold text-primary-700 ring-4 ring-surface">
                {profilePic ? (
                  <img alt="Foto do perfil" className="h-full w-full object-cover" src={profilePic} />
                ) : (
                  profile.name.charAt(0).toUpperCase()
                )}
              </span>
              <Button
                aria-label="Alterar foto de perfil"
                className="absolute bottom-0 right-0 !rounded-full shadow-raised"
                onClick={() => profilePicRef.current?.click()}
                size="icon-sm"
                variant="secondary"
              >
                <Camera size={15} />
              </Button>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold text-ink-900">{profile.name}</h2>
              <p className="truncate text-sm text-ink-500">@{profile.username}</p>
            </div>

            <div className="w-full rounded-control border border-line bg-ink-50/60 p-3 sm:w-60">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-ink-900">Nível {profile.level}</span>
                <span className="tabular text-ink-500">{profile.xp} XP</span>
              </div>
              <div
                aria-label="Progresso para o próximo nível"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={xpProgress}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100"
                role="progressbar"
              >
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${xpProgress}%` }} />
              </div>
              <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-ink-500">
                <Trophy aria-hidden className="shrink-0 text-gold" size={13} />
                {profile.lastAchievement}
              </p>
            </div>
          </div>
          <input ref={profilePicRef} accept="image/*" className="hidden" onChange={(event) => handleImageChange(event, setProfilePic)} type="file" />
          <input ref={bannerPicRef} accept="image/*" className="hidden" onChange={(event) => handleImageChange(event, setBannerPic)} type="file" />
        </Card>

        <Card aria-labelledby="titulo-dados">
          <CardHeader
            description="Clique no lápis para editar. As alterações só valem depois de salvar."
            icon={<UserRound size={18} />}
            id="titulo-dados"
            title="Dados pessoais"
          />
          <div className="divide-y divide-line">
            {renderField("Nome", "name", "text")}
            {renderField("Nome de usuário", "username")}
            {renderField("Email", "email", "email")}

            <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-40 shrink-0 text-sm text-ink-500">Senha</span>
              <span aria-hidden className="min-w-0 flex-1 tracking-[0.2em] text-ink-900">
                ••••••••
              </span>
              <Button className="self-start sm:self-auto" onClick={() => setPasswordModalOpen(true)} size="sm" variant="secondary">
                <KeyRound aria-hidden size={15} />
                Alterar senha
              </Button>
            </div>

            <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <label className="w-40 shrink-0 text-sm text-ink-500" htmlFor="perfil-cor">
                Cor de fundo
              </label>
              <div className="flex flex-1 items-center gap-3">
                <input
                  className="h-9 w-12 cursor-pointer rounded-[8px] border border-line bg-white p-0.5"
                  id="perfil-cor"
                  onChange={(event) => setProfile((current) => ({ ...current, bgColor: event.target.value }))}
                  type="color"
                  value={profile.bgColor}
                />
                <span className="font-mono text-sm text-ink-600">{profile.bgColor}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card aria-labelledby="titulo-salvar">
          <CardHeader
            description="Por segurança, confirme com a senha atual antes de salvar."
            icon={<Upload size={18} />}
            id="titulo-salvar"
            title="Salvar alterações"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="flex-1" error={errors.currentPassword} htmlFor="perfil-senha-atual" label="Senha atual">
              <PasswordInput
                id="perfil-senha-atual"
                aria-invalid={errors.currentPassword ? true : undefined}
                autoComplete="current-password"
                toggleLabel="senha atual"
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Senha atual"
                value={currentPassword}
              />
            </Field>
            <Button disabled={isSaving} onClick={() => void handleSave()}>
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
          {errors.global ? (
            <Alert className="mt-4" tone="danger">
              {errors.global}
            </Alert>
          ) : null}
          {saveSuccess ? (
            <Alert className="mt-4" tone="success">
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden size={15} />
                Alterações salvas com sucesso!
              </span>
            </Alert>
          ) : null}
        </Card>
      </div>

      <PasswordModal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} onSave={handlePasswordChange} />
    </>
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
    <Modal
      footer={
        <>
          <Button onClick={handleClose} variant="secondary">
            Cancelar
          </Button>
          <Button form="form-senha" type="submit">
            Salvar
          </Button>
        </>
      }
      onClose={handleClose}
      size="sm"
      title="Alterar senha"
      titleId="password-modal-title"
    >
      <form
        className="grid gap-4"
        id="form-senha"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field htmlFor="senha-nova" label="Nova senha">
          <PasswordInput
            id="senha-nova"
            toggleLabel="nova senha"
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Digite a nova senha"
            value={newPassword}
          />
        </Field>
        <Field htmlFor="senha-confirmar" label="Confirmar senha">
          <PasswordInput
            id="senha-confirmar"
            toggleLabel="confirmação de senha"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirme a nova senha"
            value={confirmPassword}
          />
        </Field>
        <Field htmlFor="senha-codigo" label="Código de verificação por e-mail">
          <Input id="senha-codigo" onChange={(event) => setEmailCode(event.target.value)} placeholder="Digite o código recebido" type="text" value={emailCode} />
        </Field>
      </form>
    </Modal>
  );
}
