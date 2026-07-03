"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Bell, BookOpen, Calendar, Edit2, Gift, LayoutDashboard, LogOut, Plus, Settings, Timer, Trash2, User, X } from "lucide-react";

type Subject = { date: string; endTime: string; examDate: string; id: string; name: string; notes: string; startTime: string; workDate: string };
type UserSession = { email: string; nome: string; username: string };

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }, { name: "Calendário", href: "/calendario", icon: Calendar },
  { name: "Atividade", href: "/atividade", icon: Activity }, { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
  { name: "Timer", href: "/timer", icon: Timer }, { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  { name: "Recompensas", href: "/rewards", icon: Gift }, { name: "Configurações", href: "/configuracoes", icon: Settings },
];
const emptySubject = { date: "", endTime: "", examDate: "", name: "", notes: "", startTime: "", workDate: "" };

export default function DisciplinasPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState(emptySubject);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("studyflow_session");
    if (!session) { router.push("/"); return; }
    try {
      const parsed = JSON.parse(session) as UserSession;
      const saved = localStorage.getItem(`studyflow_subjects_${parsed.email}`);
      setTimeout(() => { setUser(parsed); setSubjects(saved ? JSON.parse(saved) : []); }, 0);
    } catch { router.push("/"); }
  }, [router]);

  const save = (next: Subject[]) => {
    setSubjects(next);
    if (user) localStorage.setItem(`studyflow_subjects_${user.email}`, JSON.stringify(next));
  };
  const openNew = () => { setEditingId(null); setForm(emptySubject); setShowForm(true); };
  const openEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setForm({ date: subject.date, endTime: subject.endTime, examDate: subject.examDate, name: subject.name, notes: subject.notes, startTime: subject.startTime, workDate: subject.workDate });
    setViewing(null); setShowForm(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    save(editingId ? subjects.map((item) => item.id === editingId ? { ...form, id: editingId } : item) : [...subjects, { ...form, id: crypto.randomUUID() }]);
    setShowForm(false); setEditingId(null); setForm(emptySubject);
  };
  const remove = () => { if (deleting) save(subjects.filter((item) => item.id !== deleting.id)); setDeleting(null); };

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
          <button aria-label="Perfil" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf6f4] text-[#29645e]" type="button"><User size={22} /></button>
        </header>
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Organização acadêmica</p><h2 className="mt-1 text-2xl font-bold text-gray-800 lg:text-3xl">Disciplinas</h2><p className="mt-2 text-sm text-gray-500">Gerencie matérias, horários, provas e trabalhos.</p></div>
            <button className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#29645e] px-5 py-3 font-semibold text-white hover:bg-[#1f514d]" onClick={openNew} type="button"><Plus size={19} />Adicionar disciplina</button>
          </div>
          <section className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-[0_8px_30px_rgba(41,100,94,0.05)]">
            {subjects.length === 0 ? <div className="px-6 py-20 text-center text-gray-500">Nenhuma disciplina adicionada.</div> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[820px]">
                <thead className="bg-[#f3f8f7] text-left text-xs uppercase tracking-wider text-[#63817c]"><tr><th className="px-6 py-4">Nome</th><th className="px-6 py-4">Horário</th><th className="px-6 py-4">Data</th><th className="px-6 py-4">Anotações</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                <tbody>{subjects.map((item) => <tr className="cursor-pointer border-t border-gray-100 hover:bg-[#f9fcfb]" key={item.id} onClick={() => setViewing(item)}>
                  <td className="px-6 py-4 font-semibold text-gray-800">{item.name}</td><td className="px-6 py-4 text-sm text-gray-600">{item.startTime || "--:--"} - {item.endTime || "--:--"}</td><td className="px-6 py-4 text-sm text-gray-600">{item.date || "Sem data"}</td><td className="max-w-xs truncate px-6 py-4 text-sm text-gray-500">{item.notes || "Sem anotações"}</td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-2"><button aria-label={`Editar ${item.name}`} className="cursor-pointer rounded-xl p-2 text-[#29645e] hover:bg-[#eaf6f4]" onClick={() => openEdit(item)} type="button"><Edit2 size={18} /></button><button aria-label={`Excluir ${item.name}`} className="cursor-pointer rounded-xl p-2 text-red-500 hover:bg-red-50" onClick={() => setDeleting(item)} type="button"><Trash2 size={18} /></button></div></td>
                </tr>)}</tbody>
              </table></div>
            )}
          </section>
        </div>
      </main>

      {showForm ? <SubjectEditor form={form} onChange={setForm} onClose={() => setShowForm(false)} onSubmit={submit} /> : null}
      {viewing ? <SubjectView item={viewing} onClose={() => setViewing(null)} onEdit={() => openEdit(viewing)} /> : null}
      {deleting ? <ConfirmDelete name={deleting.name} onCancel={() => setDeleting(null)} onConfirm={remove} /> : null}
    </div>
  );
}

function SubjectEditor({ form, onChange, onClose, onSubmit }: { form: typeof emptySubject; onChange: (form: typeof emptySubject) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <Modal title="Adicionar/editar disciplina" onClose={onClose}><form className="grid gap-4" onSubmit={onSubmit}>
    <input className="rounded-2xl border border-gray-200 px-4 py-3" placeholder="Nome da disciplina" required value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
    <div className="grid gap-3 sm:grid-cols-3"><input className="rounded-2xl border border-gray-200 px-4 py-3" type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })} /><input className="rounded-2xl border border-gray-200 px-4 py-3" type="time" value={form.startTime} onChange={(e) => onChange({ ...form, startTime: e.target.value })} /><input className="rounded-2xl border border-gray-200 px-4 py-3" type="time" value={form.endTime} onChange={(e) => onChange({ ...form, endTime: e.target.value })} /></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-xs font-bold uppercase text-gray-500">Data da prova<input className="rounded-2xl border border-gray-200 px-4 py-3 text-base font-normal text-gray-700" type="date" value={form.examDate} onChange={(e) => onChange({ ...form, examDate: e.target.value })} /></label><label className="grid gap-2 text-xs font-bold uppercase text-gray-500">Data do trabalho<input className="rounded-2xl border border-gray-200 px-4 py-3 text-base font-normal text-gray-700" type="date" value={form.workDate} onChange={(e) => onChange({ ...form, workDate: e.target.value })} /></label></div>
    <textarea className="min-h-28 resize-none rounded-2xl border border-gray-200 px-4 py-3" placeholder="Anotações" value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} />
    <div className="grid gap-3 sm:grid-cols-2"><button className="cursor-pointer rounded-2xl border border-[#cfe0dd] px-4 py-3 font-semibold text-[#29645e]" onClick={onClose} type="button">Cancelar</button><button className="cursor-pointer rounded-2xl bg-[#29645e] px-4 py-3 font-semibold text-white" type="submit">Salvar</button></div>
  </form></Modal>;
}
function SubjectView({ item, onClose, onEdit }: { item: Subject; onClose: () => void; onEdit: () => void }) {
  return <Modal title={item.name} onClose={onClose}><div className="grid gap-3 text-sm text-gray-600"><p><strong>Horário:</strong> {item.startTime || "--:--"} - {item.endTime || "--:--"}</p><p><strong>Data:</strong> {item.date || "Sem data"}</p><p><strong>Prova:</strong> {item.examDate || "Não informada"}</p><p><strong>Trabalho:</strong> {item.workDate || "Não informado"}</p><p><strong>Anotações:</strong> {item.notes || "Sem anotações"}</p><button className="mt-3 cursor-pointer rounded-2xl bg-[#29645e] px-4 py-3 font-semibold text-white" onClick={onEdit} type="button">Editar</button></div></Modal>;
}
function ConfirmDelete({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return <Modal title="Excluir disciplina" onClose={onCancel}><p className="leading-7 text-gray-600">Tem certeza que deseja excluir “{name}”?</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="cursor-pointer rounded-2xl border border-gray-200 px-4 py-3" onClick={onCancel} type="button">Cancelar</button><button className="cursor-pointer rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white" onClick={onConfirm} type="button">Excluir</button></div></Modal>;
}
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142421]/45 p-5 backdrop-blur-sm"><section className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"><button aria-label="Fechar" className="absolute right-5 top-5 cursor-pointer rounded-full p-2 text-gray-400 hover:bg-gray-100" onClick={onClose} type="button"><X size={20} /></button><h3 className="mb-6 pr-10 text-2xl font-bold text-gray-800">{title}</h3>{children}</section></div>;
}
