/**
 * Página do Dashboard Principal do aplicativo Study Flow.
 * Esta tela serve como o centro de controle do usuário, apresentando
 * resumos das horas estudadas, metas de estudo por disciplina, sequência de dias ativos
 * e uma lista interativa de tarefas e prazos acadêmicos integrados com o localStorage.
 * @packageDocumentation
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar as CalendarIcon,
  LayoutDashboard,
  LogOut,
  Settings,
  Timer,
  User,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Flame,
  CheckSquare,
  Book,
  Clock,
  Sparkles,
  Gift
} from "lucide-react";

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
};

/**
 * Lista de itens de navegação do menu lateral (Sidebar).
 */
const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendário", href: "/calendario", icon: CalendarIcon },
  { name: "Atividade", href: "/atividade", icon: Activity },
  { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
  { name: "Timer", href: "/timer", icon: Timer },
  { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  { name: "Recompensas", href: "/rewards", icon: Gift },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

/**
 * Lista de disciplinas cadastradas no sistema.
 */
const disciplinesList = [
  "Banco de Dados",
  "Algoritmos",
  "Engenharia de Software",
  "Redes de Computadores",
  "Sistemas Operacionais"
];

/**
 * Componente principal da página do Dashboard.
 * Gerencia a renderização de cartões de métricas, carregamento de histórico de foco,
 * e a lista interativa de tarefas (to-do list) acadêmicas.
 */
export default function DashboardPage() {
  const router = useRouter();

  /** Dados do usuário logado */
  const [user, setUser] = useState<UserSession | null>(null);

  /** Controla a visibilidade da gaveta de notificações rápidas */
  const [showNotifications, setShowNotifications] = useState(false);

  /** Controla a visibilidade do tooltip de perfil */
  const [showProfile, setShowProfile] = useState(false);

  // Estados do Dashboard
  /** Lista completa de tarefas carregadas do usuário atual */
  const [tasks, setTasks] = useState<Task[]>([]);

  /** Título para a nova tarefa a ser criada no formulário */
  const [newTaskTitle, setNewTaskTitle] = useState("");

  /** Disciplina selecionada para a nova tarefa no formulário */
  const [newTaskDiscipline, setNewTaskDiscipline] = useState(disciplinesList[0]);

  /** Data de vencimento selecionada para a nova tarefa no formulário */
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  /** Quantidade total acumulada de horas de foco */
  const [focusHours, setFocusHours] = useState(12.5);

  /** Dias consecutivos de estudos ativos */
  const [streakDays] = useState(5);

  /**
   * Efeito executado na montagem do componente.
   * Verifica a autenticação do usuário. Em caso de sucesso, carrega os dados da sessão,
   * a lista de tarefas acadêmicas no localStorage e calcula as horas de foco totais
   * a partir do histórico de atividades reais finalizadas.
   */
  useEffect(() => {
    const storedSession = localStorage.getItem("studyflow_session");

    if (!storedSession) {
      router.push("/");
      return;
    }

    try {
      const parsedSession = JSON.parse(storedSession) as UserSession;
      setTimeout(() => setUser(parsedSession), 0);

      // Carregar Tarefas
      const storedTasks = localStorage.getItem(`studyflow_tasks_${parsedSession.email}`);
      if (storedTasks) {
        const loadedTasks = JSON.parse(storedTasks);
        setTimeout(() => setTasks(loadedTasks), 0);
      } else {
        // Tarefas iniciais de exemplo
        const defaultTasks: Task[] = [
          {
            id: "1",
            title: "Entrega do Relatório de Casos de Uso",
            discipline: "Engenharia de Software",
            dueDate: "2026-06-25",
            completed: false
          },
          {
            id: "2",
            title: "Exercícios de Álgebra de Relacional",
            discipline: "Banco de Dados",
            dueDate: "2026-06-22",
            completed: false
          },
          {
            id: "3",
            title: "Desenvolvimento do Algoritmo Dijkstra",
            discipline: "Algoritmos",
            dueDate: "2026-06-18",
            completed: true
          }
        ];
        setTimeout(() => setTasks(defaultTasks), 0);
        localStorage.setItem(`studyflow_tasks_${parsedSession.email}`, JSON.stringify(defaultTasks));
      }

      // Calcular horas de foco a partir do histórico de atividades reais se houver
      const storedActivity = localStorage.getItem(`studyflow_activity_${parsedSession.email}`);
      if (storedActivity) {
        const parsedActivity = JSON.parse(storedActivity);
        // Cada atividade de foco concluída soma 25 minutos
        const focusLogs = parsedActivity.filter((a: { type: string }) => a.type === "foco");
        const realHours = 12.5 + (focusLogs.length * 25) / 60; // 12.5h base + horas reais
        setTimeout(() => setFocusHours(parseFloat(realHours.toFixed(1))), 0);
      }

    } catch {
      localStorage.removeItem("studyflow_session");
      router.push("/");
    }
  }, [router]);

  /**
   * Atualiza a lista de tarefas no estado local e as persiste no localStorage.
   *
   * @param updatedTasks - Nova lista completa de tarefas
   */
  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    if (user) {
      localStorage.setItem(`studyflow_tasks_${user.email}`, JSON.stringify(updatedTasks));
    }
  };

  /**
   * Adiciona uma nova tarefa acadêmica à lista com base nos inputs do formulário.
   *
   * @param e - Evento de envio de formulário do React
   */
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDueDate) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      discipline: newTaskDiscipline,
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
  const handleToggleTask = (id: string) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    saveTasks(updatedTasks);
  };

  /**
   * Exclui uma tarefa específica da lista.
   *
   * @param id - Identificador único da tarefa a ser removida
   */
  const handleDeleteTask = (id: string) => {
    const updatedTasks = tasks.filter((task) => task.id !== id);
    saveTasks(updatedTasks);
  };

  const logout = () => {
    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f2fcfb]">
        <div className="text-xl font-medium text-[#29645e] animate-pulse">Carregando painel...</div>
      </div>
    );
  }

  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#f7fdfd] lg:flex-row font-[Roboto]">
      {/* SIDEBAR LATERAL */}
      <aside className="flex w-full select-none flex-col justify-between bg-[#29645e] px-4 py-6 text-white shrink-0 shadow-lg lg:w-[260px]">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <h1 className="text-2xl font-normal font-['Rubik_Bubbles'] tracking-wider">
              Study Flow
            </h1>
          </div>

          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.name === "Dashboard";
              return (
                <button
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-[15px] py-3 px-4 text-base font-medium transition duration-200 ${
                    isActive
                      ? "bg-white text-[#29645e] shadow-md scale-[1.02]"
                      : "text-gray-100 hover:bg-[#347871] hover:text-white"
                  }`}
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

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
        {/* HEADER DE AÇÕES */}
        <header className="relative flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Visão Geral</p>
            <h2 className="text-2xl font-bold text-gray-800 lg:text-3xl">Dashboard</h2>
          </div>

          <div className="relative flex items-center gap-4">
            {/* Notificações */}
            <div className="relative">
              <button
                aria-label="Abrir notificações"
                className="relative cursor-pointer rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm transition hover:bg-[#eaf6f4] hover:text-[#29645e]"
                onClick={() => {
                  setShowNotifications((currentValue) => !currentValue);
                  setShowProfile(false);
                }}
                type="button"
              >
                <Bell size={20} />
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 z-40 mt-3 w-80 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl">
                  <p className="font-semibold text-gray-700 text-sm pb-2 border-b border-gray-100">Notificações</p>
                  <div className="mt-2 flex flex-col gap-2 max-h-48 overflow-y-auto">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Sessão de foco concluída! Suas horas totais foram atualizadas.
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-2">
                      Faltam {pendingTasksCount} entregas acadêmicas para esta semana.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Perfil */}
            <div className="relative">
              <button
                aria-label="Abrir perfil"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-[#eaf6f4] text-[#29645e] shadow-sm transition hover:border-[#29645e]"
                onClick={() => router.push("/perfil")}
                type="button"
              >
                <User size={22} />
              </button>

              {showProfile && (
                <div className="absolute right-0 z-40 mt-3 w-64 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-xl">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#29645e] text-xl font-bold text-white shadow-md">
                    {user.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-semibold text-gray-800 text-base">{user.nome}</div>
                  <div className="text-xs text-gray-500 mb-1">@{user.username}</div>
                  <div className="text-xs text-gray-400 break-all">{user.email}</div>
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <button
                      className="flex w-full items-center justify-center gap-2 py-1.5 text-sm font-medium text-red-500 hover:text-red-700 cursor-pointer"
                      onClick={logout}
                      type="button"
                    >
                      <LogOut size={16} />
                      Sair da Conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MENSAGEM DE BOAS-VINDAS */}
        <section className="mt-6 flex flex-col items-start justify-between rounded-[25px] bg-[#29645e] p-6 text-white shadow-md md:flex-row md:items-center">
          <div className="mb-4 md:mb-0">
            <h3 className="text-xl font-bold md:text-2xl">Olá, {user.nome}! 👋</h3>
            <p className="text-sm text-[#c8eae5] mt-1">Pronto para os estudos de hoje? Mantenha o fluxo e o foco!</p>
          </div>
          <button
            onClick={() => router.push("/timer")}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#29645e] shadow-md hover:bg-[#eaf6f4] transition duration-200 active:scale-95"
            type="button"
          >
            <Timer size={18} />
            Iniciar Timer Pomodoro
          </button>
        </section>

        {/* CARDS DE MÉTRICAS */}
        <section className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Card 1: Horas de Foco */}
          <div className="flex items-center gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0px_4px_25px_rgba(0,0,0,0.01)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf6f4] text-[#29645e]">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Horas Estudadas</p>
              <h4 className="text-2xl font-bold text-gray-800 mt-0.5">{focusHours}h</h4>
            </div>
          </div>

          {/* Card 2: Tarefas Pendentes */}
          <div className="flex items-center gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0px_4px_25px_rgba(0,0,0,0.01)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <CheckSquare size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tarefas Pendentes</p>
              <h4 className="text-2xl font-bold text-gray-800 mt-0.5">{pendingTasksCount}</h4>
            </div>
          </div>

          {/* Card 3: Sequência de Dias */}
          <div className="flex items-center gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0px_4px_25px_rgba(0,0,0,0.01)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <Flame size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sequência Atual</p>
              <h4 className="text-2xl font-bold text-gray-800 mt-0.5">{streakDays} dias</h4>
            </div>
          </div>
        </section>

        {/* SEÇÃO DIVIDIDA: TAREFAS & DISTRIBUIÇÃO */}
        <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          {/* PAINEL ESQUERDO: Gerenciador de Entregas (Prazos) */}
          <div className="lg:col-span-7 rounded-[30px] border border-gray-100 bg-white p-6 shadow-[0px_4px_25px_rgba(0,0,0,0.02)] flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare size={20} className="text-[#29645e]" />
                <h3 className="text-lg font-bold text-gray-800">Próximos Prazos e Entregas</h3>
              </div>
              <span className="rounded-full bg-[#eaf6f4] px-3 py-1 text-xs font-bold text-[#29645e]">
                {pendingTasksCount} ativas
              </span>
            </div>

            {/* Lista de tarefas */}
            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Parabéns! Nenhuma tarefa cadastrada.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between rounded-2xl border p-4 transition duration-200 ${
                      task.completed
                        ? "bg-gray-50 border-gray-100 opacity-60"
                        : "bg-white border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className="text-gray-400 hover:text-[#29645e] transition cursor-pointer shrink-0"
                        type="button"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="text-[#29645e]" size={22} />
                        ) : (
                          <Circle size={22} />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold text-gray-700 truncate ${task.completed ? "line-through" : ""}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 font-medium">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-semibold uppercase">
                            {task.discipline}
                          </span>
                          <span>•</span>
                          <span>Vence em: {task.dueDate.split("-").reverse().join("/")}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-gray-300 hover:text-red-500 transition cursor-pointer p-1"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Formulário para adicionar nova tarefa */}
            <form onSubmit={handleAddTask} className="border-t border-gray-100 pt-4 flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nova Entrega / Prova</p>
              
              <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Descrição da entrega..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="min-w-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#29645e] md:col-span-2"
                  required
                />
                
                <select
                  value={newTaskDiscipline}
                  onChange={(e) => setNewTaskDiscipline(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 outline-none transition focus:border-[#29645e] cursor-pointer"
                >
                  {disciplinesList.map((disc) => (
                    <option key={disc} value={disc}>
                      {disc}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 outline-none transition focus:border-[#29645e]"
                  required
                />

                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl bg-[#29645e] px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-[#1e4b47] active:scale-95 md:col-span-2"
                >
                  <Plus size={18} />
                  Adicionar
                </button>
              </div>
            </form>
          </div>

          {/* PAINEL DIREITO: Distribuição de Estudos */}
          <div className="lg:col-span-5 rounded-[30px] border border-gray-100 bg-white p-6 shadow-[0px_4px_25px_rgba(0,0,0,0.02)] flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Book size={20} className="text-[#29645e]" />
              <h3 className="text-lg font-bold text-gray-800">Distribuição de Estudos</h3>
            </div>

            <div className="flex flex-col gap-5">
              {[
                { name: "Banco de Dados", hours: 5.5, max: 12, color: "bg-[#29645e]" },
                { name: "Algoritmos", hours: 4.0, max: 10, color: "bg-[#348e83]" },
                { name: "Engenharia de Software", hours: 2.0, max: 8, color: "bg-[#e5a93b]" },
                { name: "Redes de Computadores", hours: 1.0, max: 6, color: "bg-red-400" },
                { name: "Sistemas Operacionais", hours: 0, max: 6, color: "bg-gray-300" }
              ].map((item) => {
                const percentage = item.max > 0 ? (item.hours / item.max) * 100 : 0;
                return (
                  <div key={item.name} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="text-gray-400">
                        {item.hours}h <span className="font-normal">de</span> {item.max}h meta
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 rounded-2xl bg-[#eaf6f4] p-4 flex gap-3 items-start">
              <Sparkles size={20} className="text-[#29645e] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#29645e] uppercase tracking-wide">Foco Sugerido</p>
                <p className="text-xs text-[#3d7a72] leading-relaxed mt-1">
                  Você está bem adiantado em Banco de Dados! Dedique seus próximos blocos de Pomodoro para Engenharia de Software para equilibrar suas metas.
                </p>
              </div>
            </div>
          </div>
          
        </section>
      </main>
    </div>
  );
}
