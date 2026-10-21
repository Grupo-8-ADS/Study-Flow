"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Bell, BookOpen, Calendar, Edit2, Gift, LayoutDashboard, LogOut, Plus, Settings, Timer, Trash2, User, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { isValidDateString, isValidTimeString, isTimeIntervalValid } from "@studyflow/shared";

type AssessmentItem = { id: string; nome: string; data: string };

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

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }, { name: "Calendário", href: "/calendario", icon: Calendar },
  { name: "Atividade", href: "/atividade", icon: Activity }, { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
  { name: "Timer", href: "/timer", icon: Timer }, { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  { name: "Recompensas", href: "/rewards", icon: Gift }, { name: "Configurações", href: "/configuracoes", icon: Settings },
];
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
          const notes = (item.anotacoes ?? {}) as Record<string, any>;
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

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#f7fdfd] text-[#29645e]">Carregando disciplinas...</div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#f7fdfd] font-[Roboto] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col justify-between bg-[#29645e] px-4 py-6 text-white shadow-lg lg:min-h-screen lg:w-[260px]">
        <div className="flex flex-col gap-8">
          <h1 className="px-2 font-['Rubik_Bubbles'] text-2xl font-normal tracking-wider">Study Flow</h1>
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {menuItems.map((item) => { const Icon = item.icon; return <button className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium lg:w-full ${item.name === "Disciplinas" ? "bg-white text-[#29645e] shadow-md" : "text-gray-100 hover:bg-[#347871]"}`} key={item.name} onClick={() => router.push(item.href)} type="button"><Icon size={20} />{item.name}</button>; })}
          </nav>
        </div>
        <button className="mt-8 flex cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-red-200 hover:bg-[#a83232]" onClick={() => { localStorage.removeItem("studyflow_session"); router.push("/"); }} type="button"><LogOut size={20} />Sair</button>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
        <header className="mb-7 flex justify-end gap-4 border-b border-gray-100 pb-6">
          <button aria-label="Notificações" className="rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm" type="button"><Bell size={20} /></button>
          <button aria-label="Perfil" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf6f4] text-[#29645e] overflow-hidden" onClick={() => router.push("/perfil")} type="button">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.nome || "Avatar"} className="h-full w-full object-cover" />
            ) : (
              <User size={22} />
            )}
          </button>
        </header>
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Organização acadêmica</p><h2 className="mt-1 text-2xl font-bold text-gray-800 lg:text-3xl">Disciplinas</h2><p className="mt-2 text-sm text-gray-500">Gerencie matérias, horários, provas e trabalhos.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#29645e] bg-white px-4 py-3 font-semibold text-[#29645e] hover:bg-[#eaf6f4]" onClick={() => router.push("/calendario")} type="button"><Calendar size={19} />Ver no calendário</button>
              <button className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#29645e] px-5 py-3 font-semibold text-white hover:bg-[#1f514d]" onClick={openNew} type="button"><Plus size={19} />Adicionar disciplina</button>
            </div>
          </div>
          <section className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-[0_8px_30px_rgba(41,100,94,0.05)]">
            {subjects.length === 0 ? <div className="px-6 py-20 text-center text-gray-500">Nenhuma disciplina adicionada.</div> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[820px]">
                <thead className="bg-[#f3f8f7] text-left text-xs uppercase tracking-wider text-[#63817c]"><tr><th className="px-6 py-4">Nome</th><th className="px-6 py-4">Horário</th><th className="px-6 py-4">Data</th><th className="px-6 py-4">Avaliações</th><th className="px-6 py-4">Anotações</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                <tbody>{subjects.map((item) => {
                  const pCount = item.provas?.length || (item.examDate ? 1 : 0);
                  const tCount = item.trabalhos?.length || (item.workDate ? 1 : 0);
                  return (
                    <tr className="cursor-pointer border-t border-gray-100 hover:bg-[#f9fcfb]" key={item.id} onClick={() => setViewing(item)}>
                      <td className="px-6 py-4 font-semibold text-gray-800">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.startTime || "--:--"} - {item.endTime || "--:--"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.date || "Sem data"}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        <span className="inline-block rounded-lg bg-[#eaf6f4] px-2 py-1 font-medium text-[#29645e]">{pCount} prova(s)</span>
                        <span className="ml-1 inline-block rounded-lg bg-gray-100 px-2 py-1 font-medium text-gray-600">{tCount} trab.</span>
                      </td>
                      <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-500">{item.notes || "Sem anotações"}</td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-2"><button aria-label={`Editar ${item.name}`} className="cursor-pointer rounded-xl p-2 text-[#29645e] hover:bg-[#eaf6f4]" onClick={() => openEdit(item)} type="button"><Edit2 size={18} /></button><button aria-label={`Excluir ${item.name}`} className="cursor-pointer rounded-xl p-2 text-red-500 hover:bg-red-50" onClick={() => setDeleting(item)} type="button"><Trash2 size={18} /></button></div></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </section>
        </div>
      </main>

      {showForm ? <SubjectEditor error={formError} form={form} onChange={(f) => { setFormError(null); setForm(f); }} onClose={() => setShowForm(false)} onSubmit={submit} /> : null}
      {viewing ? <SubjectView item={viewing} onClose={() => setViewing(null)} onEdit={() => openEdit(viewing)} /> : null}
      {deleting ? <ConfirmDelete name={deleting.name} onCancel={() => setDeleting(null)} onConfirm={remove} /> : null}
    </div>
  );
}

function SubjectEditor({ error, form, onChange, onClose, onSubmit }: { error?: string | null; form: typeof emptySubject; onChange: (form: typeof emptySubject) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <Modal title="Adicionar/editar disciplina" onClose={onClose}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-600">
            ⚠️ {error}
          </div>
        )}
        <label className="grid gap-1 text-xs font-bold uppercase text-gray-500">
          Nome da disciplina
          <input className="rounded-2xl border border-gray-200 px-4 py-3 text-base font-normal text-gray-800" placeholder="Ex: Cálculo I" required value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold uppercase text-gray-500">
            Data da disciplina
            <input className="rounded-2xl border border-gray-200 px-4 py-3 text-base font-normal text-gray-700" type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-gray-500">
            Início
            <input className="rounded-2xl border border-gray-200 px-4 py-3 text-base font-normal text-gray-700" type="time" value={form.startTime} onChange={(e) => onChange({ ...form, startTime: e.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-gray-500">
            Término
            <input className="rounded-2xl border border-gray-200 px-4 py-3 text-base font-normal text-gray-700" type="time" value={form.endTime} onChange={(e) => onChange({ ...form, endTime: e.target.value })} />
          </label>
        </div>

        {/* Provas */}
        <div className="rounded-2xl border border-gray-100 bg-[#f9fcfb] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#29645e]">Provas / Avaliações</span>
            <button
              type="button"
              onClick={() => {
                const newProvas = [...form.provas, { id: crypto.randomUUID(), nome: `Prova ${form.provas.length + 1}`, data: "" }];
                onChange({ ...form, provas: newProvas });
              }}
              className="flex items-center gap-1 text-xs font-bold text-[#29645e] hover:underline"
            >
              <Plus size={14} /> Adicionar Prova
            </button>
          </div>
          {form.provas.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma prova adicionada. Clique acima para adicionar.</p>
          ) : (
            <div className="grid gap-2">
              {form.provas.map((p, idx) => (
                <div key={p.id || idx} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                    placeholder="Título da prova"
                    value={p.nome}
                    onChange={(e) => {
                      const next = [...form.provas];
                      next[idx] = { ...p, nome: e.target.value };
                      onChange({ ...form, provas: next });
                    }}
                  />
                  <input
                    className="w-36 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                    type="date"
                    value={p.data}
                    onChange={(e) => {
                      const next = [...form.provas];
                      next[idx] = { ...p, data: e.target.value };
                      onChange({ ...form, provas: next });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...form, provas: form.provas.filter((_, i) => i !== idx) })}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="Remover prova"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trabalhos */}
        <div className="rounded-2xl border border-gray-100 bg-[#f9fcfb] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-[#29645e]">Trabalhos / Entregas</span>
            <button
              type="button"
              onClick={() => {
                const newTrabalhos = [...form.trabalhos, { id: crypto.randomUUID(), nome: `Trabalho ${form.trabalhos.length + 1}`, data: "" }];
                onChange({ ...form, trabalhos: newTrabalhos });
              }}
              className="flex items-center gap-1 text-xs font-bold text-[#29645e] hover:underline"
            >
              <Plus size={14} /> Adicionar Trabalho
            </button>
          </div>
          {form.trabalhos.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum trabalho adicionado. Clique acima para adicionar.</p>
          ) : (
            <div className="grid gap-2">
              {form.trabalhos.map((t, idx) => (
                <div key={t.id || idx} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                    placeholder="Título do trabalho"
                    value={t.nome}
                    onChange={(e) => {
                      const next = [...form.trabalhos];
                      next[idx] = { ...t, nome: e.target.value };
                      onChange({ ...form, trabalhos: next });
                    }}
                  />
                  <input
                    className="w-36 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                    type="date"
                    value={t.data}
                    onChange={(e) => {
                      const next = [...form.trabalhos];
                      next[idx] = { ...t, data: e.target.value };
                      onChange({ ...form, trabalhos: next });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...form, trabalhos: form.trabalhos.filter((_, i) => i !== idx) })}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="Remover trabalho"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <textarea className="min-h-24 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm" placeholder="Anotações gerais..." value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="cursor-pointer rounded-2xl border border-[#cfe0dd] px-4 py-3 font-semibold text-[#29645e]" onClick={onClose} type="button">Cancelar</button>
          <button className="cursor-pointer rounded-2xl bg-[#29645e] px-4 py-3 font-semibold text-white" type="submit">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function SubjectView({ item, onClose, onEdit }: { item: Subject; onClose: () => void; onEdit: () => void }) {
  const provas = item.provas && item.provas.length > 0 
    ? item.provas 
    : (item.examDate ? [{ id: "legacy-exam", nome: "Prova", data: item.examDate }] : []);
  const trabalhos = item.trabalhos && item.trabalhos.length > 0 
    ? item.trabalhos 
    : (item.workDate ? [{ id: "legacy-work", nome: "Trabalho", data: item.workDate }] : []);

  return (
    <Modal title={item.name} onClose={onClose}>
      <div className="grid gap-3 text-sm text-gray-600">
        <p><strong>Horário:</strong> {item.startTime || "--:--"} - {item.endTime || "--:--"}</p>
        <p><strong>Data da disciplina:</strong> {item.date || "Sem data"}</p>

        <div>
          <strong className="text-gray-800">Provas:</strong>
          {provas.length === 0 ? (
            <span className="ml-2 text-gray-400">Nenhuma prova cadastrada</span>
          ) : (
            <ul className="mt-1 space-y-1 pl-2">
              {provas.map((p, idx) => (
                <li key={p.id || idx} className="flex justify-between rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="font-medium text-gray-700">{p.nome || `Prova ${idx + 1}`}</span>
                  <span className="text-gray-500">{p.data || "Sem data"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <strong className="text-gray-800">Trabalhos:</strong>
          {trabalhos.length === 0 ? (
            <span className="ml-2 text-gray-400">Nenhum trabalho cadastrado</span>
          ) : (
            <ul className="mt-1 space-y-1 pl-2">
              {trabalhos.map((t, idx) => (
                <li key={t.id || idx} className="flex justify-between rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="font-medium text-gray-700">{t.nome || `Trabalho ${idx + 1}`}</span>
                  <span className="text-gray-500">{t.data || "Sem data"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p><strong>Anotações:</strong> {item.notes || "Sem anotações"}</p>
        <button className="mt-3 cursor-pointer rounded-2xl bg-[#29645e] px-4 py-3 font-semibold text-white" onClick={onEdit} type="button">Editar</button>
      </div>
    </Modal>
  );
}

function ConfirmDelete({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return <Modal title="Excluir disciplina" onClose={onCancel}><p className="leading-7 text-gray-600">Tem certeza que deseja excluir “{name}”?</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="cursor-pointer rounded-2xl border border-gray-200 px-4 py-3" onClick={onCancel} type="button">Cancelar</button><button className="cursor-pointer rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white" onClick={onConfirm} type="button">Excluir</button></div></Modal>;
}
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142421]/45 p-5 backdrop-blur-sm"><section className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"><button aria-label="Fechar" className="absolute right-5 top-5 cursor-pointer rounded-full p-2 text-gray-400 hover:bg-gray-100" onClick={onClose} type="button"><X size={20} /></button><h3 className="mb-6 pr-10 text-2xl font-bold text-gray-800">{title}</h3>{children}</section></div>;
}

