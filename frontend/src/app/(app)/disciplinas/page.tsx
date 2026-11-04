"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { isValidDateString, isValidTimeString, isTimeIntervalValid } from "@studyflow/shared";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

type AssessmentItem = { id: string; nome: string; data: string };

/** Formato das anotacoes (JSON) salvas em cada disciplina */
type NotasDisciplina = {
  provas?: AssessmentItem[];
  trabalhos?: AssessmentItem[];
  examDate?: string;
  workDate?: string;
  endTime?: string;
  startTime?: string;
  notes?: string;
};

type Subject = {
  date: string;
  endTime: string;
  examDate?: string;
  id: string;
  name: string;
  notes: string;
  provas: AssessmentItem[];
  startTime: string;
  trabalhos: AssessmentItem[];
  workDate?: string;
};

type UserSession = { email: string; nome: string; username: string; avatar_url?: string | null };

const emptySubject: Omit<Subject, "id"> = {
  date: "",
  endTime: "",
  examDate: "",
  name: "",
  notes: "",
  provas: [],
  startTime: "",
  trabalhos: [],
  workDate: "",
};

export default function DisciplinasPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState(emptySubject);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  // Enquanto o modo de dados (Supabase x local) não é resolvido, criar uma disciplina
  // a gravaria só no localStorage e ela sumiria ao fim do carregamento.
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      const parsed = getStoredSession();
      if (!parsed) { router.push("/"); return; }

      try {
        setUser(parsed);
        const currentUserId = await getCurrentSupabaseUserId(parsed);
        setSupabaseUserId(currentUserId);

        if (!currentUserId) {
          const saved = localStorage.getItem(`studyflow_subjects_${parsed.email}`);
          setSubjects(saved ? JSON.parse(saved) : []);
          return;
        }

        const [{ data }, { data: profile }] = await Promise.all([
          supabase
            .from("disciplinas")
            .select("id,nome,data_inicio,data_fim,anotacoes")
            .eq("user_id", currentUserId)
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("avatar_url").eq("id", currentUserId).maybeSingle(),
        ]);

        if (profile?.avatar_url) {
          setUser((curr) => curr ? { ...curr, avatar_url: profile.avatar_url } : null);
        }

        setSubjects((data ?? []).map((item) => {
          const notes = (item.anotacoes ?? {}) as NotasDisciplina;
          const provas: AssessmentItem[] = Array.isArray(notes.provas)
            ? notes.provas
            : notes.examDate
            ? [{ id: "legacy-exam", nome: "Prova", data: notes.examDate }]
            : [];
          const trabalhos: AssessmentItem[] = Array.isArray(notes.trabalhos)
            ? notes.trabalhos
            : notes.workDate
            ? [{ id: "legacy-work", nome: "Trabalho", data: notes.workDate }]
            : [];

          return {
            date: item.data_inicio ?? "",
            endTime: notes.endTime ?? "",
            examDate: notes.examDate ?? "",
            id: item.id,
            name: item.nome,
            notes: notes.notes ?? "",
            provas,
            startTime: notes.startTime ?? "",
            trabalhos,
            workDate: notes.workDate ?? "",
          };
        }));
      } catch {
        router.push("/");
      } finally {
        setLoadingData(false);
      }
    }

    void loadSubjects();
  }, [router]);

  const save = (next: Subject[]) => {
    setSubjects(next);
    if (user && !supabaseUserId) localStorage.setItem(`studyflow_subjects_${user.email}`, JSON.stringify(next));
  };
  const openNew = () => { setEditingId(null); setForm(emptySubject); setFormError(null); setShowForm(true); };
  const openEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setForm({
      date: subject.date,
      endTime: subject.endTime,
      examDate: subject.examDate || "",
      name: subject.name,
      notes: subject.notes,
      provas: subject.provas ? [...subject.provas] : [],
      startTime: subject.startTime,
      trabalhos: subject.trabalhos ? [...subject.trabalhos] : [],
      workDate: subject.workDate || "",
    });
    setFormError(null);
    setViewing(null);
    setShowForm(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("Informe o nome da disciplina.");
      return;
    }

    if (form.date && !isValidDateString(form.date)) {
      setFormError("A data da disciplina é inválida.");
      return;
    }

    for (const p of form.provas) {
      if (p.data && !isValidDateString(p.data)) {
        setFormError(`A data da prova "${p.nome || 'sem título'}" é inválida.`);
        return;
      }
    }

    for (const t of form.trabalhos) {
      if (t.data && !isValidDateString(t.data)) {
        setFormError(`A data do trabalho "${t.nome || 'sem título'}" é inválida.`);
        return;
      }
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

    const finalForm = {
      ...form,
      examDate: form.provas[0]?.data || form.examDate || "",
      workDate: form.trabalhos[0]?.data || form.workDate || "",
    };

    if (supabaseUserId) {
      const payload = {
        anotacoes: {
          endTime: form.endTime,
          examDate: finalForm.examDate,
          notes: form.notes,
          provas: form.provas,
          startTime: form.startTime,
          trabalhos: form.trabalhos,
          workDate: finalForm.workDate,
        },
        data_fim: form.date || null,
        data_inicio: form.date || null,
        nome: form.name.trim(),
        user_id: supabaseUserId,
      };

      if (editingId) {
        await supabase.from("disciplinas").update(payload).eq("id", editingId).eq("user_id", supabaseUserId);
        save(subjects.map((item) => (item.id === editingId ? { ...finalForm, id: editingId } : item)));
      } else {
        const { data } = await supabase.from("disciplinas").insert(payload).select("id").single();
        if (data) save([{ ...finalForm, id: data.id }, ...subjects]);
      }
    } else {
      save(editingId ? subjects.map((item) => (item.id === editingId ? { ...finalForm, id: editingId } : item)) : [{ ...finalForm, id: crypto.randomUUID() }, ...subjects]);
    }

    setShowForm(false); setEditingId(null); setForm(emptySubject); setFormError(null);
  };
  const remove = async () => {
    if (!deleting) return;
    if (supabaseUserId) await supabase.from("disciplinas").delete().eq("id", deleting.id).eq("user_id", supabaseUserId);
    save(subjects.filter((item) => item.id !== deleting.id));
    setDeleting(null);
  };

  if (!user) return <PageLoading label="Carregando disciplinas..." />;

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={buttonClass("secondary")} href="/calendario">
              <CalendarDays aria-hidden size={18} />
              Ver no calendário
            </Link>
            <Button disabled={loadingData} onClick={openNew}>
              <Plus aria-hidden size={18} />
              Adicionar disciplina
            </Button>
          </>
        }
        description="Matérias que você está cursando, com horários, provas e trabalhos."
        title="Disciplinas"
      />

      {subjects.length === 0 ? (
        <EmptyState
          action={
            <Button disabled={loadingData} onClick={openNew}>
              <Plus aria-hidden size={18} />
              Cadastrar primeira disciplina
            </Button>
          }
          className="bg-white py-16"
          description="Cadastre suas matérias para organizar provas, trabalhos e o cronograma de estudos."
          icon={<BookOpen size={22} />}
          title={loadingData ? "Carregando disciplinas..." : "Nenhuma disciplina adicionada"}
        />
      ) : (
        <>
          {/* Celular: lista de cartões */}
          <ul className="flex flex-col gap-3 md:hidden">
            {subjects.map((item) => (
              <li key={item.id}>
                <Card as="article" className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setViewing(item)} type="button">
                      <p className="truncate font-semibold text-ink-900">{item.name}</p>
                      <p className="mt-0.5 text-sm text-ink-500">
                        {formatTimeRange(item)} · {formatDate(item.date)}
                      </p>
                    </button>
                    <RowActions item={item} onDelete={() => setDeleting(item)} onEdit={() => openEdit(item)} />
                  </div>
                  <AssessmentBadges item={item} />
                </Card>
              </li>
            ))}
          </ul>

          {/* Tablet e desktop: tabela */}
          <Card className="hidden overflow-hidden md:block" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-ink-50 text-xs font-medium text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-medium" scope="col">Nome</th>
                    <th className="px-5 py-3 font-medium" scope="col">Horário</th>
                    <th className="px-5 py-3 font-medium" scope="col">Data</th>
                    <th className="px-5 py-3 font-medium" scope="col">Avaliações</th>
                    <th className="px-5 py-3 font-medium" scope="col">Anotações</th>
                    <th className="px-5 py-3 text-right font-medium" scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((item) => (
                    <tr className="cursor-pointer border-t border-line transition-colors first:border-t-0 hover:bg-primary-50/50" key={item.id} onClick={() => setViewing(item)}>
                      <td className="px-5 py-3.5 font-medium text-ink-900">{item.name}</td>
                      <td className="tabular px-5 py-3.5 text-ink-600">{formatTimeRange(item)}</td>
                      <td className="tabular px-5 py-3.5 text-ink-600">{formatDate(item.date)}</td>
                      <td className="px-5 py-3.5">
                        <AssessmentBadges inline item={item} />
                      </td>
                      <td className="max-w-[16rem] truncate px-5 py-3.5 text-ink-500">{item.notes || "—"}</td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
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
        <SubjectEditor
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
      {viewing ? <SubjectView item={viewing} onClose={() => setViewing(null)} onEdit={() => openEdit(viewing)} /> : null}
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
          title="Excluir disciplina"
        >
          <p className="text-sm text-ink-600">
            Tem certeza que deseja excluir “{deleting.name}”? Essa ação não pode ser desfeita.
          </p>
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

function formatTimeRange(item: Subject) {
  if (!item.startTime && !item.endTime) return "Sem horário";
  return `${item.startTime || "--:--"} – ${item.endTime || "--:--"}`;
}

function provasOf(item: Subject) {
  return item.provas && item.provas.length > 0 ? item.provas : item.examDate ? [{ id: "legacy-exam", nome: "Prova", data: item.examDate }] : [];
}

function trabalhosOf(item: Subject) {
  return item.trabalhos && item.trabalhos.length > 0 ? item.trabalhos : item.workDate ? [{ id: "legacy-work", nome: "Trabalho", data: item.workDate }] : [];
}

function AssessmentBadges({ item, inline = false }: { item: Subject; inline?: boolean }) {
  const p = provasOf(item).length;
  const t = trabalhosOf(item).length;
  return (
    <div className={`flex flex-wrap gap-1.5 ${inline ? "" : "mt-3"}`}>
      <Badge tone={p > 0 ? "primary" : "neutral"}>
        {p} {p === 1 ? "prova" : "provas"}
      </Badge>
      <Badge tone={t > 0 ? "gold" : "neutral"}>
        {t} {t === 1 ? "trabalho" : "trabalhos"}
      </Badge>
    </div>
  );
}

function RowActions({ item, onEdit, onDelete }: { item: Subject; onEdit: () => void; onDelete: () => void }) {
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

type AssessmentListProps = {
  items: AssessmentItem[];
  kind: "prova" | "trabalho";
  onChange: (items: AssessmentItem[]) => void;
};

function AssessmentList({ items, kind, onChange }: AssessmentListProps) {
  const title = kind === "prova" ? "Provas e avaliações" : "Trabalhos e entregas";
  const addLabel = kind === "prova" ? "Adicionar Prova" : "Adicionar Trabalho";
  const singular = kind === "prova" ? "Prova" : "Trabalho";
  return (
    <fieldset className="rounded-card border border-line bg-ink-50/60 p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-ink-800">{title}</legend>
        <Button onClick={() => onChange([...items, { id: crypto.randomUUID(), nome: `${singular} ${items.length + 1}`, data: "" }])} size="sm" variant="secondary">
          <Plus aria-hidden size={14} />
          {addLabel}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhum{kind === "prova" ? "a prova" : " trabalho"} adicionad{kind === "prova" ? "a" : "o"}.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((entry, idx) => (
            <li className="flex items-center gap-2" key={entry.id || idx}>
              <Input
                aria-label={`Título ${kind === "prova" ? "da prova" : "do trabalho"} ${idx + 1}`}
                className="flex-1"
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...entry, nome: e.target.value };
                  onChange(next);
                }}
                placeholder={`Título ${kind === "prova" ? "da prova" : "do trabalho"}`}
                value={entry.nome}
              />
              <Input
                aria-label={`Data ${kind === "prova" ? "da prova" : "do trabalho"} ${idx + 1}`}
                className="!w-40"
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...entry, data: e.target.value };
                  onChange(next);
                }}
                type="date"
                value={entry.data}
              />
              <Button
                aria-label={kind === "prova" ? "Remover prova" : "Remover trabalho"}
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                size="icon-sm"
                variant="danger-ghost"
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function SubjectEditor({
  error,
  form,
  isEditing,
  onChange,
  onClose,
  onSubmit,
}: {
  error?: string | null;
  form: typeof emptySubject;
  isEditing: boolean;
  onChange: (form: typeof emptySubject) => void;
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
          <Button form="form-disciplina" type="submit">
            Salvar
          </Button>
        </>
      }
      onClose={onClose}
      title={isEditing ? "Editar disciplina" : "Nova disciplina"}
    >
      <form className="grid gap-4" id="form-disciplina" onSubmit={onSubmit}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field htmlFor="disciplina-nome" label="Nome da disciplina">
          <Input id="disciplina-nome" onChange={(e) => onChange({ ...form, name: e.target.value })} placeholder="Ex.: Cálculo I" required value={form.name} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field htmlFor="disciplina-data" label="Data">
            <Input id="disciplina-data" onChange={(e) => onChange({ ...form, date: e.target.value })} type="date" value={form.date} />
          </Field>
          <Field htmlFor="disciplina-inicio" label="Início">
            <Input id="disciplina-inicio" onChange={(e) => onChange({ ...form, startTime: e.target.value })} type="time" value={form.startTime} />
          </Field>
          <Field htmlFor="disciplina-fim" label="Término">
            <Input id="disciplina-fim" onChange={(e) => onChange({ ...form, endTime: e.target.value })} type="time" value={form.endTime} />
          </Field>
        </div>

        <AssessmentList items={form.provas} kind="prova" onChange={(provas) => onChange({ ...form, provas })} />
        <AssessmentList items={form.trabalhos} kind="trabalho" onChange={(trabalhos) => onChange({ ...form, trabalhos })} />

        <Field htmlFor="disciplina-notas" label="Anotações">
          <Textarea
            className="min-h-24 resize-y"
            id="disciplina-notas"
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            placeholder="Professor, sala, links úteis..."
            value={form.notes}
          />
        </Field>
      </form>
    </Modal>
  );
}

function SubjectView({ item, onClose, onEdit }: { item: Subject; onClose: () => void; onEdit: () => void }) {
  const provas = provasOf(item);
  const trabalhos = trabalhosOf(item);

  return (
    <Modal
      description={`${formatTimeRange(item)} · ${formatDate(item.date)}`}
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Fechar
          </Button>
          <Button onClick={onEdit}>
            <Pencil aria-hidden size={16} />
            Editar
          </Button>
        </>
      }
      onClose={onClose}
      title={item.name}
    >
      <div className="grid gap-5 text-sm">
        {[
          { label: "Provas", items: provas, empty: "Nenhuma prova cadastrada" },
          { label: "Trabalhos", items: trabalhos, empty: "Nenhum trabalho cadastrado" },
        ].map((group) => (
          <section key={group.label}>
            <h3 className="mb-2 text-sm font-semibold text-ink-800">{group.label}</h3>
            {group.items.length === 0 ? (
              <p className="text-ink-500">{group.empty}</p>
            ) : (
              <ul className="divide-y divide-line rounded-control border border-line">
                {group.items.map((entry, idx) => (
                  <li className="flex justify-between gap-3 px-3 py-2" key={entry.id || idx}>
                    <span className="font-medium text-ink-800">{entry.nome || `${group.label.slice(0, -1)} ${idx + 1}`}</span>
                    <span className="tabular text-ink-500">{formatDate(entry.data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink-800">Anotações</h3>
          <p className="whitespace-pre-wrap text-ink-600">{item.notes || "Sem anotações"}</p>
        </section>
      </div>
    </Modal>
  );
}
