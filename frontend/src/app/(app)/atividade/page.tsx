"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { isValidDateString, isValidTimeString, isTimeIntervalValid } from "@studyflow/shared";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

type StudyActivity = {
  date: string;
  endTime: string;
  id: string;
  name: string;
  notes: string;
  startTime: string;
};

type UserSession = { email: string; nome: string; username: string; avatar_url?: string | null };

const emptyActivity = { date: "", endTime: "", name: "", notes: "", startTime: "" };

export default function AtividadePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [activities, setActivities] = useState<StudyActivity[]>([]);
  const [form, setForm] = useState(emptyActivity);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<StudyActivity | null>(null);
  const [deleting, setDeleting] = useState<StudyActivity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivities() {
      const parsed = getStoredSession();
      if (!parsed) {
        router.push("/");
        return;
      }

      try {
        setUser(parsed);
        const currentUserId = await getCurrentSupabaseUserId(parsed);
        setSupabaseUserId(currentUserId);

        if (!currentUserId) {
          const saved = localStorage.getItem(`studyflow_activities_${parsed.email}`);
          setActivities(saved ? JSON.parse(saved) : []);
          return;
        }

        const [{ data }, { data: profile }] = await Promise.all([
          supabase
            .from("itens_cronograma")
            .select("id,nome,data_inicio,data_fim,descricao")
            .eq("user_id", currentUserId)
            .eq("tipo", "atividade")
            .order("data_inicio", { ascending: true }),
          supabase.from("profiles").select("avatar_url").eq("id", currentUserId).maybeSingle(),
        ]);

        if (profile?.avatar_url) {
          setUser((curr) => curr ? { ...curr, avatar_url: profile.avatar_url } : null);
        }

        setActivities((data ?? []).map((item) => {
          const startDate = item.data_inicio ? new Date(item.data_inicio) : null;
          const endDate = item.data_fim ? new Date(item.data_fim) : null;

          return {
            date: startDate?.toISOString().slice(0, 10) ?? "",
            endTime: endDate?.toISOString().slice(11, 16) ?? "",
            id: item.id,
            name: item.nome,
            notes: item.descricao ?? "",
            startTime: startDate?.toISOString().slice(11, 16) ?? "",
          };
        }));
      } catch {
        router.push("/");
      }
    }

    void loadActivities();
  }, [router]);

  const saveActivities = (next: StudyActivity[]) => {
    setActivities(next);
    if (user && !supabaseUserId) localStorage.setItem(`studyflow_activities_${user.email}`, JSON.stringify(next));
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyActivity);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (activity: StudyActivity) => {
    setEditingId(activity.id);
    setForm({
      date: activity.date,
      endTime: activity.endTime,
      name: activity.name,
      notes: activity.notes,
      startTime: activity.startTime,
    });
    setFormError(null);
    setViewing(null);
    setShowForm(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("Informe o nome da atividade.");
      return;
    }

    if (form.date && !isValidDateString(form.date)) {
      setFormError("A data informada é inválida. Utilize o formato correto.");
      return;
    }

    if (form.startTime && !isValidTimeString(form.startTime)) {
      setFormError("O horário de início é inválido.");
      return;
    }

    if (form.endTime && !isValidTimeString(form.endTime)) {
      setFormError("O horário de término é inválido.");
      return;
    }

    if (form.startTime && form.endTime && !isTimeIntervalValid(form.startTime, form.endTime)) {
      setFormError("O horário de término deve ser posterior ao horário de início.");
      return;
    }

    if (supabaseUserId) {
      const dataInicio = form.date && form.startTime ? `${form.date}T${form.startTime}:00` : null;
      const dataFim = form.date && form.endTime ? `${form.date}T${form.endTime}:00` : dataInicio;
      const payload = {
        data_fim: dataFim,
        data_inicio: dataInicio,
        descricao: form.notes,
        nome: form.name.trim(),
        tipo: "atividade",
        user_id: supabaseUserId,
      };

      if (editingId) {
        await supabase.from("itens_cronograma").update(payload).eq("id", editingId).eq("user_id", supabaseUserId);
        saveActivities(activities.map((item) => (item.id === editingId ? { ...form, id: editingId } : item)));
      } else {
        const { data } = await supabase.from("itens_cronograma").insert(payload).select("id").single();
        if (data) saveActivities([...activities, { ...form, id: data.id }]);
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyActivity);
      setFormError(null);
      return;
    }

    const next = editingId
      ? activities.map((item) => (item.id === editingId ? { ...form, id: editingId } : item))
      : [...activities, { ...form, id: crypto.randomUUID() }];

    saveActivities(next);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyActivity);
    setFormError(null);
  };

  const remove = async () => {
    if (!deleting) return;
    if (supabaseUserId) await supabase.from("itens_cronograma").delete().eq("id", deleting.id).eq("user_id", supabaseUserId);
    saveActivities(activities.filter((item) => item.id !== deleting.id));
    setDeleting(null);
  };

  if (!user) return <PageLoading label="Carregando atividades..." />;

  const ordered = [...activities].sort((a, b) => `${a.date || "9999"}${a.startTime}`.localeCompare(`${b.date || "9999"}${b.startTime}`));

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={buttonClass("secondary")} href="/calendario">
              <CalendarDays aria-hidden size={18} />
              Ver no calendário
            </Link>
            <Button onClick={openNew}>
              <Plus aria-hidden size={18} />
              Adicionar atividade
            </Button>
          </>
        }
        description="Compromissos com dia e horário: aulas extras, grupos de estudo, reuniões e lembretes."
        title="Atividades"
      />

      {ordered.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={openNew}>
              <Plus aria-hidden size={18} />
              Adicionar atividade
            </Button>
          }
          className="bg-white py-16"
          description="Elas aparecem também no calendário da Agenda."
          icon={<ListChecks size={22} />}
          title="Nenhuma atividade adicionada"
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {ordered.map((item) => (
              <li key={item.id}>
                <Card as="article" className="flex items-start gap-3 !p-4">
                  <DateChip date={item.date} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setViewing(item)} type="button">
                    <p className="truncate font-semibold text-ink-900">{item.name}</p>
                    <p className="mt-0.5 text-sm text-ink-500">{formatTimeRange(item)}</p>
                    {item.notes ? <p className="mt-1 line-clamp-2 text-sm text-ink-500">{item.notes}</p> : null}
                  </button>
                  <RowActions item={item} onDelete={() => setDeleting(item)} onEdit={() => openEdit(item)} />
                </Card>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-hidden md:block" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-ink-50 text-xs text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-medium" scope="col">Nome</th>
                    <th className="px-5 py-3 font-medium" scope="col">Data</th>
                    <th className="px-5 py-3 font-medium" scope="col">Horário</th>
                    <th className="px-5 py-3 font-medium" scope="col">Anotações</th>
                    <th className="px-5 py-3 font-medium" scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((item) => (
                    <tr className="cursor-pointer border-t border-line transition-colors first:border-t-0 hover:bg-primary-50/50" key={item.id} onClick={() => setViewing(item)}>
                      <td className="px-5 py-3.5 font-medium text-ink-900">{item.name}</td>
                      <td className="tabular px-5 py-3.5 text-ink-600">{formatDate(item.date)}</td>
                      <td className="tabular px-5 py-3.5 text-ink-600">{formatTimeRange(item)}</td>
                      <td className="max-w-[18rem] truncate px-5 py-3.5 text-ink-500">{item.notes || "—"}</td>
                      <td className="px-5 py-3.5" onClick={(event) => event.stopPropagation()}>
                        <RowActions item={item} onDelete={() => setDeleting(item)} onEdit={() => openEdit(item)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {showForm ? (
        <EditorModal
          error={formError}
          form={form}
          isEditing={Boolean(editingId)}
          onChange={(f) => {
            setFormError(null);
            setForm(f);
          }}
          onClose={() => setShowForm(false)}
          onSubmit={submit}
        />
      ) : null}
      {viewing ? (
        <Modal
          description={`${formatDate(viewing.date)} · ${formatTimeRange(viewing)}`}
          footer={
            <>
              <Button onClick={() => setViewing(null)} variant="secondary">
                Fechar
              </Button>
              <Button onClick={() => openEdit(viewing)}>
                <Pencil aria-hidden size={16} />
                Editar
              </Button>
            </>
          }
          onClose={() => setViewing(null)}
          title={viewing.name}
        >
          <h3 className="mb-1 text-sm font-semibold text-ink-800">Anotações</h3>
          <p className="whitespace-pre-wrap text-sm text-ink-600">{viewing.notes || "Sem anotações"}</p>
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          footer={
            <>
              <Button onClick={() => setDeleting(null)} variant="secondary">
                Cancelar
              </Button>
              <Button onClick={remove} variant="danger">
                Excluir
              </Button>
            </>
          }
          onClose={() => setDeleting(null)}
          size="sm"
          title="Excluir atividade"
        >
          <p className="text-sm text-ink-600">Tem certeza que deseja excluir “{deleting.name}”? Esta ação não poderá ser desfeita.</p>
        </Modal>
      ) : null}
    </>
  );
}

function formatDate(value?: string) {
  if (!value) return "Sem data";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function formatTimeRange(item: StudyActivity) {
  if (!item.startTime && !item.endTime) return "Sem horário";
  return `${item.startTime || "--:--"} – ${item.endTime || "--:--"}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function DateChip({ date }: { date: string }) {
  const [, m, d] = date ? date.split("-") : [];
  return (
    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-primary-50 text-primary-800 ring-1 ring-primary-100" aria-hidden>
      <span className="text-base font-semibold leading-none">{d ?? "—"}</span>
      <span className="mt-0.5 text-[11px] uppercase leading-none">{m ? MONTHS[Number(m) - 1] : ""}</span>
    </span>
  );
}

function RowActions({ item, onEdit, onDelete }: { item: StudyActivity; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <Button aria-label={`Editar ${item.name}`} onClick={onEdit} size="icon-sm" variant="ghost">
        <Pencil size={16} />
      </Button>
      <Button aria-label={`Excluir ${item.name}`} onClick={onDelete} size="icon-sm" variant="danger-ghost">
        <Trash2 size={16} />
      </Button>
    </div>
  );
}

function EditorModal({
  error,
  form,
  isEditing,
  onChange,
  onClose,
  onSubmit,
}: {
  error?: string | null;
  form: typeof emptyActivity;
  isEditing: boolean;
  onChange: (form: typeof emptyActivity) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button form="form-atividade" type="submit">
            Salvar
          </Button>
        </>
      }
      onClose={onClose}
      title={isEditing ? "Editar atividade" : "Nova atividade"}
    >
      <form className="grid gap-4" id="form-atividade" onSubmit={onSubmit}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field htmlFor="atividade-nome" label="Nome da atividade">
          <Input id="atividade-nome" onChange={(e) => onChange({ ...form, name: e.target.value })} placeholder="Ex.: Grupo de estudos de Cálculo" required value={form.name} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field htmlFor="atividade-data" label="Data">
            <Input id="atividade-data" onChange={(e) => onChange({ ...form, date: e.target.value })} type="date" value={form.date} />
          </Field>
          <Field htmlFor="atividade-inicio" label="Início">
            <Input id="atividade-inicio" onChange={(e) => onChange({ ...form, startTime: e.target.value })} type="time" value={form.startTime} />
          </Field>
          <Field htmlFor="atividade-fim" label="Término">
            <Input id="atividade-fim" onChange={(e) => onChange({ ...form, endTime: e.target.value })} type="time" value={form.endTime} />
          </Field>
        </div>
        <Field htmlFor="atividade-notas" label="Anotações">
          <Textarea className="min-h-28 resize-y" id="atividade-notas" onChange={(e) => onChange({ ...form, notes: e.target.value })} value={form.notes} />
        </Field>
      </form>
    </Modal>
  );
}
