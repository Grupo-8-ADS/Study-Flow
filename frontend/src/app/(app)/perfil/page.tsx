"use client";

import { useRef, useState } from "react";
import { Camera, Check, Crop, ImageIcon, KeyRound, Pencil, Shuffle, Trash2, Trophy, Upload, UserRound } from "lucide-react";
import { ImageCropper } from "@/components/image-cropper";
import { FundoBanner, MolduraAvatar } from "@/components/moldura-avatar";

import { supabase } from "@/lib/supabase";
import { atualizarPerfilEmCache, usePerfil, type PerfilUsuario } from "@/lib/perfil";
import {
  ESTILOS_AVATAR,
  bannerPreset,
  mensagemErroPerfil,
  novasSementes,
  progressoNivel,
  urlAvatar,
  validarNovaSenha,
  validarPerfil,
  type EstiloAvatar,
} from "@studyflow/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, PageLoading } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

const COR_PADRAO = "#0F1C1D";

type CampoEditavel = "nome" | "username";

export default function PerfilPage() {
  const { dados: perfil, erro } = usePerfil();

  if (!perfil) {
    return erro ? <Alert tone="danger">{erro}</Alert> : <PageLoading label="Carregando perfil..." />;
  }
  // A chave remonta o formulário se outra pessoa entrar na mesma aba.
  return <PerfilConteudo key={perfil.id} perfil={perfil} />;
}

function PerfilConteudo({ perfil }: { perfil: PerfilUsuario }) {
  const [form, setForm] = useState({ nome: perfil.nome, username: perfil.username });
  const [bgColor, setBgColor] = useState(perfil.bg_color || COR_PADRAO);
  const [profilePic, setProfilePic] = useState<string | null>(perfil.avatar_url);
  const [bannerPic, setBannerPic] = useState<string | null>(perfil.banner_url);
  const [editando, setEditando] = useState<{ campo: CampoEditavel; valor: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [recorte, setRecorte] = useState<{ src: string; formato: "avatar" | "banner" } | null>(null);
  const [galeriaAvatar, setGaleriaAvatar] = useState(false);
  const profilePicRef = useRef<HTMLInputElement>(null);
  const bannerPicRef = useRef<HTMLInputElement>(null);

  /** Há mudanças ainda não salvas. */
  const alterado =
    form.nome !== perfil.nome ||
    form.username !== perfil.username ||
    bgColor !== (perfil.bg_color || COR_PADRAO) ||
    profilePic !== perfil.avatar_url ||
    bannerPic !== perfil.banner_url;

  const sucesso = (mensagem: string) => {
    setSaveSuccess(mensagem);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const confirmarEdicao = () => {
    if (editando) setForm((atual) => ({ ...atual, [editando.campo]: editando.valor }));
    setEditando(null);
  };

  /** Abre o arquivo escolhido direto no recorte (a foto original não é salva). */
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>, formato: "avatar" | "banner") => {
    const file = event.target.files?.[0];
    // Permite escolher o mesmo arquivo de novo depois.
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErro("Escolha um arquivo de imagem.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (readerEvent) => setRecorte({ src: String(readerEvent.target?.result ?? ""), formato });
    reader.readAsDataURL(file);
  };

  const escolherArquivo = (formato: "avatar" | "banner") => (formato === "avatar" ? profilePicRef : bannerPicRef).current?.click();

  const aplicarRecorte = (dataUrl: string) => {
    if (recorte?.formato === "avatar") setProfilePic(dataUrl);
    else setBannerPic(dataUrl);
    setRecorte(null);
  };

  const handleSave = async () => {
    const validacao = validarPerfil(editando ? { ...form, [editando.campo]: editando.valor } : form);
    if ("erro" in validacao) {
      setErro(validacao.erro);
      return;
    }
    setErro(null);
    setIsSaving(true);
    const alteracao = {
      nome: validacao.dados.nome,
      username: validacao.dados.username,
      bg_color: bgColor,
      avatar_url: profilePic,
      banner_url: bannerPic,
    };
    try {
      const { error } = await supabase.from("profiles").update(alteracao).eq("id", perfil.id);
      if (error) {
        setErro(mensagemErroPerfil(error));
        return;
      }
      setEditando(null);
      setForm({ nome: alteracao.nome, username: alteracao.username });
      atualizarPerfilEmCache(alteracao);
      sucesso("Alterações salvas.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (label: string, campo: CampoEditavel) => {
    const emEdicao = editando?.campo === campo;
    const inputId = `perfil-${campo}`;

    return (
      <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
        <label className="w-40 shrink-0 text-sm text-ink-500" htmlFor={emEdicao ? inputId : undefined}>
          {label}
        </label>
        <div className="min-w-0 flex-1">
          {emEdicao ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                autoFocus
                className="flex-1"
                id={inputId}
                onChange={(event) => setEditando({ campo, valor: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") confirmarEdicao();
                  if (event.key === "Escape") setEditando(null);
                }}
                value={editando.valor}
              />
              <div className="flex gap-2">
                <Button onClick={confirmarEdicao} size="sm">
                  OK
                </Button>
                <Button onClick={() => setEditando(null)} size="sm" variant="secondary">
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <span className="break-words text-sm font-medium text-ink-900">{form[campo]}</span>
          )}
        </div>
        {!emEdicao ? (
          <Button aria-label={`Editar ${label}`} className="self-end sm:self-auto" onClick={() => setEditando({ campo, valor: form[campo] })} size="icon-sm" variant="ghost">
            <Pencil size={16} />
          </Button>
        ) : null}
      </div>
    );
  };

  const xpProgress = Math.round(progressoNivel(perfil.xp).progresso * 100);

  return (
    <>
      <PageHeader title="Perfil" />

      {recorte ? <ImageCropper formato={recorte.formato} onCancel={() => setRecorte(null)} onConfirm={aplicarRecorte} src={recorte.src} /> : null}
      {galeriaAvatar ? (
        <GaleriaAvatares
          onClose={() => setGaleriaAvatar(false)}
          onEscolher={(url) => {
            setProfilePic(url);
            setGaleriaAvatar(false);
          }}
        />
      ) : null}

      <div className="grid max-w-4xl gap-6">
        <Card className="overflow-hidden" padded={false}>
          <div className="relative h-32 sm:h-40">
            <FundoBanner corPadrao={bgColor} valor={bannerPic} />
            <div className="absolute right-3 top-3 flex gap-2">
              {bannerPic ? (
                <>
                  {bannerPreset(bannerPic) ? null : (
                    <Button aria-label="Ajustar banner" onClick={() => setRecorte({ src: bannerPic, formato: "banner" })} size="icon-sm" variant="inverse">
                      <Crop size={15} />
                    </Button>
                  )}
                  <Button aria-label="Remover banner" onClick={() => setBannerPic(null)} size="icon-sm" variant="inverse">
                    <Trash2 size={15} />
                  </Button>
                </>
              ) : null}
              <Button onClick={() => escolherArquivo("banner")} size="sm" variant="inverse">
                <ImageIcon aria-hidden size={15} />
                {bannerPic ? "Trocar banner" : "Adicionar banner"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6 sm:pb-6">
            <div className="relative -mt-12 h-24 w-24 shrink-0 sm:h-28 sm:w-28">
              <MolduraAvatar className="h-full w-full" espessura={4} moldura={perfil.moldura}>
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-100 text-3xl font-semibold text-primary-700 ring-4 ring-surface">
                  {profilePic ? <img alt="Foto do perfil" className="h-full w-full object-cover" src={profilePic} /> : form.nome.charAt(0).toUpperCase()}
                </span>
              </MolduraAvatar>
              <Button
                aria-label="Alterar foto de perfil"
                className="absolute bottom-0 right-0 !rounded-full shadow-raised"
                onClick={() => escolherArquivo("avatar")}
                size="icon-sm"
                variant="secondary"
              >
                <Camera size={15} />
              </Button>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold text-ink-900">{form.nome}</h2>
              <p className="truncate text-sm text-ink-500">@{form.username}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button onClick={() => escolherArquivo("avatar")} size="sm" variant="secondary">
                  <Upload aria-hidden size={14} />
                  {profilePic ? "Trocar foto" : "Enviar foto"}
                </Button>
                <Button onClick={() => setGaleriaAvatar(true)} size="sm" variant="secondary">
                  <Shuffle aria-hidden size={14} />
                  Gerar avatar
                </Button>
                {profilePic ? (
                  <>
                    <Button aria-label="Ajustar foto" onClick={() => setRecorte({ src: profilePic, formato: "avatar" })} size="icon-sm" variant="ghost">
                      <Crop size={15} />
                    </Button>
                    <Button aria-label="Remover foto" onClick={() => setProfilePic(null)} size="icon-sm" variant="danger-ghost">
                      <Trash2 size={15} />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="w-full rounded-control border border-line bg-ink-50/60 p-3 sm:w-60">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-ink-900">Nível {perfil.nivel_atual}</span>
                <span className="tabular text-ink-500">{perfil.xp.toLocaleString("pt-BR")} XP</span>
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
                {perfil.last_achievement ?? "Nenhuma conquista ainda"}
              </p>
            </div>
          </div>
          <input ref={profilePicRef} accept="image/*" className="hidden" onChange={(event) => handleImageChange(event, "avatar")} type="file" />
          <input ref={bannerPicRef} accept="image/*" className="hidden" onChange={(event) => handleImageChange(event, "banner")} type="file" />
          {alterado ? <p className="px-5 pb-4 text-xs text-ink-500 sm:px-6">As mudanças valem depois de salvar o perfil.</p> : null}
        </Card>

        <Card aria-labelledby="titulo-dados">
          <CardHeader icon={<UserRound size={18} />} id="titulo-dados" title="Dados pessoais" />
          <div className="divide-y divide-line">
            {renderField("Nome", "nome")}
            {renderField("Nome de usuário", "username")}

            <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-40 shrink-0 text-sm text-ink-500">Email</span>
              <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink-900">{perfil.email}</span>
            </div>

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
                  onChange={(event) => setBgColor(event.target.value)}
                  type="color"
                  value={bgColor}
                />
                <span className="font-mono text-sm text-ink-600">{bgColor}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button disabled={isSaving || (!alterado && !editando)} onClick={() => void handleSave()}>
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
          {erro ? (
            <Alert className="mt-4" tone="danger">
              {erro}
            </Alert>
          ) : null}
          {saveSuccess ? (
            <Alert className="mt-4" tone="success">
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden size={15} />
                {saveSuccess}
              </span>
            </Alert>
          ) : null}
        </Card>
      </div>

      {passwordModalOpen ? <PasswordModal onClose={() => setPasswordModalOpen(false)} onSaved={() => sucesso("Senha alterada.")} /> : null}
    </>
  );
}

/** Troca de senha com as mesmas regras do app (tamanho mínimo e confirmação). */
function PasswordModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    const problema = validarNovaSenha(newPassword, confirmPassword);
    if (problema) {
      setError(problema);
      return;
    }
    setError("");
    setSalvando(true);
    try {
      const { error: falha } = await supabase.auth.updateUser({ password: newPassword });
      if (falha) {
        setError(falha.code === "same_password" ? "A nova senha precisa ser diferente da atual." : "Não foi possível alterar a senha.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Sem conexão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button disabled={salvando} form="form-senha" type="submit">
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
      onClose={onClose}
      size="sm"
      title="Alterar senha"
      titleId="password-modal-title"
    >
      <form
        className="grid gap-4"
        id="form-senha"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field htmlFor="senha-nova" label="Nova senha">
          <PasswordInput
            autoComplete="new-password"
            id="senha-nova"
            toggleLabel="nova senha"
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Mínimo de 6 caracteres"
            value={newPassword}
          />
        </Field>
        <Field htmlFor="senha-confirmar" label="Confirmar senha">
          <PasswordInput
            autoComplete="new-password"
            id="senha-confirmar"
            toggleLabel="confirmação de senha"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a nova senha"
            value={confirmPassword}
          />
        </Field>
      </form>
    </Modal>
  );
}

function GaleriaAvatares({ onClose, onEscolher }: { onClose: () => void; onEscolher: (url: string) => void }) {
  const [estilo, setEstilo] = useState<EstiloAvatar>(ESTILOS_AVATAR[0].id);
  const [sementes, setSementes] = useState(() => novasSementes());
  return (
    <Modal
      footer={
        <>
          <Button onClick={() => setSementes(novasSementes())} variant="secondary">
            <Shuffle aria-hidden size={15} />
            Outros
          </Button>
          <Button onClick={onClose} variant="ghost">
            Fechar
          </Button>
        </>
      }
      onClose={onClose}
      title="Escolher um avatar"
    >
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Estilo">
        {ESTILOS_AVATAR.map((e) => (
          <button
            aria-pressed={estilo === e.id}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              estilo === e.id ? "border-primary-700 bg-primary-700 text-white" : "border-line bg-white text-ink-700 hover:border-ink-300"
            }`}
            key={e.id}
            onClick={() => setEstilo(e.id)}
            type="button"
          >
            {e.nome}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-4 gap-3">
        {sementes.map((semente) => (
          <li key={semente}>
            <button
              aria-label="Usar este avatar"
              className="aspect-square w-full overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-primary-500 focus-visible:ring-primary-600"
              onClick={() => onEscolher(urlAvatar(estilo, semente))}
              type="button"
            >
              <img alt="" className="h-full w-full" loading="lazy" src={urlAvatar(estilo, semente)} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-500">
        Avatares gerados pelo{" "}
        <a className="underline" href="https://www.dicebear.com" rel="noreferrer" target="_blank">
          DiceBear
        </a>{" "}
        (estilos com licença CC0).
      </p>
    </Modal>
  );
}
