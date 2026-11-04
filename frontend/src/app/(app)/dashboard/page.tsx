/**
 * Página do Dashboard Principal do aplicativo Study Flow.
 * Esta tela serve como o centro de controle do usuário, apresentando
 * resumos das horas estudadas, metas de estudo por disciplina, sequência de dias ativos
 * e uma lista interativa de tarefas e prazos acadêmicos integrados com o localStorage.
 * @packageDocumentation
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarCheck, CheckCircle2, Circle, Clock, Flame, Plus, Sparkles, Timer, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buildDistribution,
  calculateStreak,
  getCurrentSupabaseUserId,
  getLocalStudyMinutes,
  getStoredSession,
  type StudyDistribution,
} from "@/lib/studyflow-data";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState, PageLoading } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Representa os dados da sessão do usuário autenticado no sistema.
 */
type UserSession = {
  /** Endereço de e-mail do usuário logado */
  email: string;
  /** Nome completo do usuário */
  nome: string;
  /** Nome de usuário/apelido único do usuário */
  username: string;
  avatar_url?: string | null;
};

/**
 * Representa a estrutura de uma tarefa/entrega cadastrada pelo usuário.
 */
type Task = {
  /** Identificador único da tarefa (gerado dinamicamente) */
  id: string;
  /** Título ou descrição da entrega */
  title: string;
  /** Disciplina acadêmica relacionada à tarefa */
  discipline: string;
  /** Data limite para a entrega (formato YYYY-MM-DD) */
  dueDate: string;
  /** Estado de conclusão da tarefa */
  completed: boolean;
  /** Identificador da disciplina no Supabase, quando existir */
  disciplineId?: string | null;
};

type DisciplineOption = {
  id: string;
  name: string;
};

/**
 * Lista de itens de navegação do menu lateral (Sidebar).
 */
/**
 * Lista de disciplinas cadastradas no sistema.
 */
/**
 * Componente principal da página do Dashboard.
 * Gerencia a renderização de cartões de métricas, carregamento de histórico de foco,
 * e a lista interativa de tarefas (to-do list) acadêmicas.
 */
export default function DashboardPage() {
  const router = useRouter();

  /** Dados do usuário logado */
  const [user, setUser] = useState<UserSession | null>(null);



  // Estados do Dashboard
  /** Lista completa de tarefas carregadas do usuário atual */
  const [tasks, setTasks] = useState<Task[]>([]);

  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  const [disciplineOptions, setDisciplineOptions] = useState<DisciplineOption[]>([]);

  /** Título para a nova tarefa a ser criada no formulário */
  const [newTaskTitle, setNewTaskTitle] = useState("");

  /** Disciplina selecionada para a nova tarefa no formulário */
  const [newTaskDiscipline, setNewTaskDiscipline] = useState("");

  /** Data de vencimento selecionada para a nova tarefa no formulário */
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  /** Quantidade total acumulada de horas de foco */
  const [focusHours, setFocusHours] = useState(0);

  /** Dias consecutivos de estudos ativos */
  const [streakDays, setStreakDays] = useState(0);

  const [studyDistribution, setStudyDistribution] = useState<StudyDistribution[]>([]);

  /**
   * Efeito executado na montagem do componente.
   * Verifica a autenticação do usuário. Em caso de sucesso, carrega os dados da sessão,
   * a lista de tarefas acadêmicas no localStorage e calcula as horas de foco totais
   * a partir do histórico de atividades reais finalizadas.
   */
  useEffect(() => {
    async function loadDashboard() {
      const parsedSession = getStoredSession();

      if (!parsedSession) {
        router.push("/");
        return;
      }

      try {
        setUser(parsedSession);

        const currentUserId = await getCurrentSupabaseUserId(parsedSession);
        setSupabaseUserId(currentUserId);

        if (!currentUserId) {
          const storedTasks = localStorage.getItem(`studyflow_tasks_${parsedSession.email}`);
          const storedSubjects = localStorage.getItem(`studyflow_subjects_${parsedSession.email}`);
          const localTasks = storedTasks ? (JSON.parse(storedTasks) as Task[]) : [];
          const localSubjects = storedSubjects
            ? (JSON.parse(storedSubjects) as Array<{ id: string; name: string }>).map((subject) => ({
                id: subject.id,
                name: subject.name,
              }))
            : [];
          const localMinutes = getLocalStudyMinutes(parsedSession.email);

          setTasks(localTasks);
          setDisciplineOptions(localSubjects);
          setNewTaskDiscipline((current) => current || localSubjects[0]?.id || "");
          setFocusHours(Number((localMinutes / 60).toFixed(1)));
          setStreakDays(0);
          setStudyDistribution([]);
          return;
        }

        const [{ data: disciplinas }, { data: itens }, { data: sessoes }, { data: profile }] = await Promise.all([
          supabase.from("disciplinas").select("id,nome").eq("user_id", currentUserId).order("created_at"),
          supabase
            .from("itens_cronograma")
            .select("id,nome,disciplina_id,data_fim,completed,disciplinas(nome)")
            .eq("user_id", currentUserId)
            .order("data_fim", { ascending: true }),
          supabase
            .from("sessoes_estudo")
            .select("duracao_efetiva_min,status,data_inicio,disciplinas(nome)")
            .eq("user_id", currentUserId),
          supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", currentUserId)
            .maybeSingle(),
        ]);

        if (profile?.avatar_url) {
          setUser((curr) => (curr ? { ...curr, avatar_url: profile.avatar_url } : null));
        }

        const disciplineRows = (disciplinas ?? []).map((disciplina) => ({
          id: disciplina.id as string,
          name: disciplina.nome as string,
        }));

        const taskRows = (itens ?? []).map((item) => {
          const disciplina = Array.isArray(item.disciplinas) ? item.disciplinas[0] : item.disciplinas;

          return {
            completed: Boolean(item.completed),
            discipline: disciplina?.nome ?? "Sem disciplina",
            disciplineId: item.disciplina_id,
            dueDate: item.data_fim ? String(item.data_fim).slice(0, 10) : "",
            id: item.id as string,
            title: item.nome as string,
          };
        });

        const completedSessions = (sessoes ?? []).filter((sessao) => sessao.status === "concluida");
        const totalMinutes = completedSessions.reduce((sum, sessao) => sum + (sessao.duracao_efetiva_min ?? 0), 0);
        const distributionRows = completedSessions.map((sessao) => {
          const disciplina = Array.isArray(sessao.disciplinas) ? sessao.disciplinas[0] : sessao.disciplinas;

          return {
            disciplina: disciplina?.nome ?? null,
            minutes: sessao.duracao_efetiva_min ?? 0,
          };
        });

        setDisciplineOptions(disciplineRows);
        setNewTaskDiscipline((current) => current || disciplineRows[0]?.id || "");
        setTasks(taskRows);
        setFocusHours(Number((totalMinutes / 60).toFixed(1)));
        setStreakDays(calculateStreak(completedSessions.map((sessao) => String(sessao.data_inicio))));
        setStudyDistribution(buildDistribution(distributionRows));
      } catch {
        localStorage.removeItem("studyflow_session");
        router.push("/");
      }
    }

    void loadDashboard();
  }, [router]);

  /**
   * Atualiza a lista de tarefas no estado local e as persiste no localStorage.
   *
   * @param updatedTasks - Nova lista completa de tarefas
   */
  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    if (user && !supabaseUserId) {
      localStorage.setItem(`studyflow_tasks_${user.email}`, JSON.stringify(updatedTasks));
    }
  };

  /**
   * Adiciona uma nova tarefa acadêmica à lista com base nos inputs do formulário.
   *
   * @param e - Evento de envio de formulário do React
   */
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDueDate) return;

    if (supabaseUserId) {
      const selectedDiscipline = disciplineOptions.find((discipline) => discipline.id === newTaskDiscipline);
      const { data } = await supabase
        .from("itens_cronograma")
        .insert({
          completed: false,
          data_fim: `${newTaskDueDate}T23:59:00`,
          disciplina_id: selectedDiscipline?.id || null,
          nome: newTaskTitle.trim(),
          tipo: "entrega",
          user_id: supabaseUserId,
        })
        .select("id")
        .single();

      if (!data) return;

      saveTasks([
        ...tasks,
        {
          completed: false,
          discipline: selectedDiscipline?.name || "Sem disciplina",
          disciplineId: selectedDiscipline?.id || null,
          dueDate: newTaskDueDate,
          id: data.id,
          title: newTaskTitle.trim(),
        },
      ]);
      setNewTaskTitle("");
      setNewTaskDueDate("");
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      discipline: disciplineOptions.find((discipline) => discipline.id === newTaskDiscipline)?.name || "Sem disciplina",
      disciplineId: newTaskDiscipline || null,
      dueDate: newTaskDueDate,
      completed: false
    };

    const updatedTasks = [...tasks, newTask];
    saveTasks(updatedTasks);
    setNewTaskTitle("");
    setNewTaskDueDate("");
  };

  /**
   * Alterna o estado de conclusão (`completed`) de uma tarefa específica.
   *
   * @param id - Identificador único da tarefa a ser alterada
   */
  const handleToggleTask = async (id: string) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    const changedTask = updatedTasks.find((task) => task.id === id);

    if (supabaseUserId && changedTask) {
      await supabase
        .from("itens_cronograma")
        .update({ completed: changedTask.completed })
        .eq("id", id)
        .eq("user_id", supabaseUserId);
    }

    saveTasks(updatedTasks);
  };

  /**
   * Exclui uma tarefa específica da lista.
   *
   * @param id - Identificador único da tarefa a ser removida
   */
  const handleDeleteTask = async (id: string) => {
    if (supabaseUserId) {
      await supabase.from("itens_cronograma").delete().eq("id", id).eq("user_id", supabaseUserId);
    }

    const updatedTasks = tasks.filter((task) => task.id !== id);
    saveTasks(updatedTasks);
  };


  if (!user) {
    return <PageLoading label="Carregando painel..." />;
  }

  const pendingTasksCount = tasks.filter((t) => !t.completed).length;
  const firstName = user.nome.trim().split(/\s+/)[0] || user.nome;
  const orderedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });

  return (
    <>
      <PageHeader
        actions={
          <Link className={buttonClass("primary", "md")} href="/timer">
            <Timer aria-hidden size={18} />
            Iniciar sessão de foco
          </Link>
        }
        description="Um resumo do seu ritmo de estudos e do que vem pela frente."
        title={`Olá, ${firstName}!`}
      />

      <section aria-label="Resumo" className="grid grid-cols-3 gap-3 sm:gap-4">
        <Stat icon={<Clock size={22} />} label="Horas estudadas" value={`${focusHours.toLocaleString("pt-BR")}h`} />
        <Stat icon={<CalendarCheck size={22} />} label="Prazos pendentes" tone="warning" value={pendingTasksCount} />
        <Stat
          icon={<Flame size={22} />}
          label="Sequência atual"
          tone="danger"
          value={`${streakDays} ${streakDays === 1 ? "dia" : "dias"}`}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader
            action={<Badge tone="primary">{pendingTasksCount} {pendingTasksCount === 1 ? "pendente" : "pendentes"}</Badge>}
            description="Entregas e provas, da mais próxima para a mais distante."
            icon={<CalendarCheck size={18} />}
            title="Próximos prazos"
          />

          {orderedTasks.length === 0 ? (
            <EmptyState
              description="Cadastre uma entrega ou prova abaixo para acompanhar aqui."
              icon={<CalendarCheck size={22} />}
              title="Nenhum prazo cadastrado"
            />
          ) : (
            <ul className="-mx-2 flex max-h-[360px] flex-col overflow-y-auto">
              {orderedTasks.map((task) => (
                <li
                  className="group flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-ink-50"
                  key={task.id}
                >
                  <button
                    aria-label={task.completed ? `Marcar "${task.title}" como pendente` : `Concluir "${task.title}"`}
                    aria-pressed={task.completed}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-primary-100 hover:text-primary-700"
                    onClick={() => handleToggleTask(task.id)}
                    type="button"
                  >
                    {task.completed ? <CheckCircle2 className="text-primary-600" size={22} /> : <Circle size={22} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${task.completed ? "text-ink-400 line-through" : "text-ink-900"}`}>
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <Badge>{task.discipline}</Badge>
                      <DueLabel completed={task.completed} date={task.dueDate} />
                    </div>
                  </div>
                  <Button
                    aria-label={`Excluir "${task.title}"`}
                    className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    onClick={() => handleDeleteTask(task.id)}
                    size="icon-sm"
                    variant="danger-ghost"
                  >
                    <Trash2 size={16} />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form className="mt-5 border-t border-line pt-5" onSubmit={handleAddTask}>
            <p className="mb-3 text-sm font-semibold text-ink-800">Novo prazo</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                aria-label="Descrição do prazo"
                className="sm:col-span-2"
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Ex.: Lista de exercícios 3"
                required
                type="text"
                value={newTaskTitle}
              />
              <Select aria-label="Disciplina do prazo" onChange={(e) => setNewTaskDiscipline(e.target.value)} value={newTaskDiscipline}>
                <option value="">Sem disciplina</option>
                {disciplineOptions.map((disc) => (
                  <option key={disc.id} value={disc.id}>
                    {disc.name}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Data de entrega"
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                required
                type="date"
                value={newTaskDueDate}
              />
            </div>
            <Button className="mt-3 w-full sm:w-auto" type="submit">
              <Plus aria-hidden size={18} />
              Adicionar prazo
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col lg:col-span-5">
          <CardHeader
            description="Horas por disciplina nas sessões concluídas."
            icon={<BookOpen size={18} />}
            title="Distribuição de estudos"
          />

          {studyDistribution.length === 0 ? (
            <EmptyState
              action={
                <Link className={buttonClass("secondary", "sm")} href="/timer">
                  Abrir o Timer
                </Link>
              }
              description="Conclua uma sessão no Timer para ver como suas horas se dividem."
              icon={<Clock size={22} />}
              title="Nenhuma sessão concluída ainda"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {studyDistribution.map((item) => {
                const percentage = item.max > 0 ? (item.hours / item.max) * 100 : 0;
                return (
                  <li className="flex flex-col gap-1.5" key={item.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-ink-800">{item.name}</span>
                      <span className="tabular shrink-0 text-xs text-ink-500">
                        {item.hours.toLocaleString("pt-BR")}h de {item.max}h
                      </span>
                    </div>
                    <div
                      aria-label={`${item.name}: ${item.hours} de ${item.max} horas`}
                      aria-valuemax={item.max}
                      aria-valuemin={0}
                      aria-valuenow={item.hours}
                      className="h-2 w-full overflow-hidden rounded-full bg-ink-100"
                      role="progressbar"
                    >
                      <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-auto pt-5">
            <div className="flex items-start gap-3 rounded-control bg-primary-50 p-4 ring-1 ring-primary-100">
              <Sparkles aria-hidden className="mt-0.5 shrink-0 text-primary-700" size={18} />
              <div>
                <p className="text-sm font-semibold text-primary-800">Foco sugerido</p>
                <p className="mt-0.5 text-sm text-primary-800/80">
                  {studyDistribution.length > 0
                    ? "Continue registrando sessões para equilibrar suas horas entre as disciplinas."
                    : "Conclua uma sessão no Timer para gerar sugestões reais de estudo."}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

/** Mostra o prazo de forma relativa ("Hoje", "Amanhã", "Em 5 dias", "Atrasado"). */
function DueLabel({ date, completed }: { date: string; completed: boolean }) {
  if (!date) return <span>Sem data</span>;
  const [year, month, day] = date.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const formatted = date.split("-").reverse().join("/");

  if (completed) return <span>Concluído · {formatted}</span>;
  if (diff < 0) return <span className="font-medium text-danger">Atrasado · {formatted}</span>;
  if (diff === 0) return <span className="font-medium text-warning">Hoje</span>;
  if (diff === 1) return <span className="font-medium text-warning">Amanhã</span>;
  return (
    <span>
      Em {diff} dias · {formatted}
    </span>
  );
}
