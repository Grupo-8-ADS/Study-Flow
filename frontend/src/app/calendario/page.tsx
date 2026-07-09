/**
 * Página do Calendário Acadêmico do aplicativo Study Flow.
 * Esta tela exibe uma grade mensal (Junho de 2026), lista os compromissos
 * associados ao dia selecionado e permite criar, visualizar e deletar eventos
 * (Provas, Trabalhos e Estudos), persistindo os dados no localStorage do usuário.
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
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
  Gift
} from "lucide-react";

/**
 * Representa a sessão ativa do usuário autenticado no sistema.
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
 * Representa a estrutura de um evento registrado no calendário.
 */
type CalendarEvent = {
  /** Identificador único do evento (normalmente timestamp gerado pelo Date.now()) */
  id: string;
  /** Título ou descrição resumida do compromisso */
  title: string;
  /** Data do evento no formato ISO 'YYYY-MM-DD' */
  date: string;
  /** Nome da disciplina acadêmica relacionada ao evento */
  discipline: string;
  /** Tipo do evento para categorização e estilo visual */
  type: "Prova" | "Trabalho" | "Estudo";
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
 * Lista de disciplinas pré-cadastradas para seleção ao criar compromissos.
 */
const disciplinesList = [
  "Banco de Dados",
  "Algoritmos",
  "Engenharia de Software",
  "Redes de Computadores",
  "Sistemas Operacionais"
];

/**
 * Componente principal da página de Calendário.
 * Renderiza o painel de gerenciamento de compromissos acadêmicos mensais e diários.
 */
export default function CalendarioPage() {
  const router = useRouter();

  /** Sessão do usuário logado ou null se não autenticado */
  const [user, setUser] = useState<UserSession | null>(null);

  /** Controla a exibição da gaveta de notificações rápidas */
  const [showNotifications, setShowNotifications] = useState(false);

  /** Controla a exibição do tooltip/modal de detalhes de perfil */
  const [showProfile, setShowProfile] = useState(false);

  /** Lista completa de eventos carregados do usuário atual */
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  /** Data atualmente selecionada no calendário (padrão '2026-06-19') */
  const [selectedDate, setSelectedDate] = useState<string>("2026-06-19");

  /** Título para o novo evento a ser criado no formulário */
  const [newEventTitle, setNewEventTitle] = useState("");

  /** Disciplina selecionada para o novo evento no formulário */
  const [newEventDiscipline, setNewEventDiscipline] = useState(disciplinesList[0]);

  /** Tipo do novo evento selecionado no formulário */
  const [newEventType, setNewEventType] = useState<"Prova" | "Trabalho" | "Estudo">("Prova");

  /** Controla a exibição do formulário de adição rápida de eventos */
  const [showAddModal, setShowAddModal] = useState(false);

  /**
   * Efeito executado ao montar o componente.
   * Verifica a autenticação do usuário. Se válido, carrega os dados de sessão
   * e busca os eventos persistidos no localStorage correspondentes ao e-mail do usuário.
   * Caso contrário, redireciona para a página de login.
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

      // Carregar Eventos
      const storedEvents = localStorage.getItem(`studyflow_events_${parsedSession.email}`);
      if (storedEvents) {
        const loadedEvents = JSON.parse(storedEvents);
        setTimeout(() => setEvents(loadedEvents), 0);
      } else {
        // Eventos padrão de exemplo
        const defaultEvents: CalendarEvent[] = [
          {
            id: "e1",
            title: "Prova de Banco de Dados I",
            date: "2026-06-22",
            discipline: "Banco de Dados",
            type: "Prova"
          },
          {
            id: "e2",
            title: "Entrega do Relatório de UML",
            date: "2026-06-25",
            discipline: "Engenharia de Software",
            type: "Trabalho"
          },
          {
            id: "e3",
            title: "Grupo de Estudos Dijkstra",
            date: "2026-06-18",
            discipline: "Algoritmos",
            type: "Estudo"
          },
          {
            id: "e4",
            title: "Estudar Protocolo TCP/IP",
            date: "2026-06-19",
            discipline: "Redes de Computadores",
            type: "Estudo"
          }
        ];
        setTimeout(() => setEvents(defaultEvents), 0);
        localStorage.setItem(`studyflow_events_${parsedSession.email}`, JSON.stringify(defaultEvents));
      }
    } catch {
      localStorage.removeItem("studyflow_session");
      router.push("/");
    }
  }, [router]);

  /**
   * Atualiza a lista de eventos no estado local e os persiste no localStorage.
   *
   * @param updatedEvents - Nova lista completa de eventos
   */
  const saveEvents = (updatedEvents: CalendarEvent[]) => {
    setEvents(updatedEvents);
    if (user) {
      localStorage.setItem(`studyflow_events_${user.email}`, JSON.stringify(updatedEvents));
    }
  };

  /**
   * Lida com o fluxo de submissão do formulário para adicionar um novo compromisso.
   * Cria um objeto {@link CalendarEvent} com dados preenchidos, anexa à lista e persiste.
   *
   * @param e - Evento de envio do formulário React
   */
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: newEventTitle.trim(),
      date: selectedDate,
      discipline: newEventDiscipline,
      type: newEventType
    };

    const updatedEvents = [...events, newEvent];
    saveEvents(updatedEvents);
    setNewEventTitle("");
    setShowAddModal(false);
  };

  /**
   * Deleta um evento do calendário a partir de seu identificador único.
   * Filtra a lista para remover o item correspondente e atualiza a persistência.
   *
   * @param id - Identificador único do evento a ser deletado
   */
  const handleDeleteEvent = (id: string) => {
    const updatedEvents = events.filter((e) => e.id !== id);
    saveEvents(updatedEvents);
  };

  /**
   * Encerra a sessão ativa do usuário limpando o localStorage e redireciona para a tela de login.
   */
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

  // Geração do Grid do Calendário (Junho 2026)
  // Junho de 2026 tem 30 dias e começa em uma segunda-feira (1).
  const totalDaysInMonth = 30;
  const startDayOffset = 0; // Segunda-feira = 0
  const calendarCells = [];

  // Adiciona células vazias para alinhamento se o mês não começasse na segunda-feira
  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push(null);
  }

  // Adiciona os dias de Junho
  for (let day = 1; day <= totalDaysInMonth; day++) {
    calendarCells.push(day);
  }

  // Filtra eventos para a data selecionada atualmente
  const selectedDateEvents = events.filter((e) => e.date === selectedDate);

  // Mapeamento de Cores por Tipo de Evento
  const typeColors = {
    Prova: "bg-red-500",
    Trabalho: "bg-amber-500",
    Estudo: "bg-emerald-500"
  };

  const typeLabels = {
    Prova: "text-red-600 bg-red-50 border-red-200",
    Trabalho: "text-amber-700 bg-amber-50 border-amber-200",
    Estudo: "text-emerald-700 bg-emerald-50 border-emerald-200"
  };

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
              const isActive = item.name === "Calendário";
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
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Seu cronograma</p>
            <h2 className="text-2xl font-bold text-gray-800 lg:text-3xl">Calendário</h2>
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

        {/* CONTROLES DO MÊS E SINCRONIZAÇÃO */}
        <section className="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-800">Junho 2026</h3>
            <div className="flex gap-1">
              <button className="p-1 rounded bg-white border border-gray-100 hover:bg-[#eaf6f4] transition text-gray-400 hover:text-[#29645e] cursor-not-allowed" disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="p-1 rounded bg-white border border-gray-100 hover:bg-[#eaf6f4] transition text-gray-400 hover:text-[#29645e] cursor-not-allowed" disabled>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <button
            className="flex items-center gap-2 rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed shadow-sm border border-gray-200 select-none"
            disabled
            title="Sincronização desabilitada nesta versão"
            type="button"
          >
            <RefreshCw size={16} />
            Sincronizar (Inativo)
          </button>
        </section>

        {/* GRID DO CALENDÁRIO & DETALHES DO DIA */}
        <section className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          {/* PAINEL ESQUERDO: Grade do Calendário */}
          <div className="lg:col-span-8 rounded-[30px] border border-gray-100 bg-white p-6 shadow-[0px_4px_25px_rgba(0,0,0,0.02)]">
            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[#5f8d87] text-xs uppercase tracking-wider mb-4">
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>

            {/* Dias do mês */}
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-16 lg:h-24 bg-transparent" />;
                }

                const dateStr = `2026-06-${day.toString().padStart(2, "0")}`;
                const isSelected = selectedDate === dateStr;
                const isToday = day === 19; // Junho 19 é hoje
                const dayEvents = events.filter((e) => e.date === dateStr);

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`h-16 lg:h-24 rounded-2xl border flex flex-col justify-between p-2 cursor-pointer transition select-none ${
                      isSelected
                        ? "border-[#29645e] bg-[#eaf6f4]"
                        : isToday
                        ? "border-[#348e83] bg-teal-50/30"
                        : "border-gray-50 hover:border-gray-200 bg-white"
                    }`}
                  >
                    <span className={`text-xs font-bold ${
                      isToday ? "text-[#29645e] bg-teal-100 rounded-full w-5 h-5 flex items-center justify-center" : "text-gray-500"
                    }`}>
                      {day}
                    </span>

                    {/* Pontinhos para indicar eventos */}
                    <div className="flex gap-1 flex-wrap mt-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={`w-1.5 h-1.5 rounded-full ${typeColors[event.type]}`}
                          title={`${event.title} (${event.type})`}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[9px] text-[#29645e] font-bold leading-none">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PAINEL DIREITO: Detalhes do Dia Selecionado */}
          <div className="lg:col-span-4 rounded-[30px] border border-gray-100 bg-white p-6 shadow-[0px_4px_25px_rgba(0,0,0,0.02)] flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Dia {selectedDate.split("-")[2]} de Junho
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-semibold">
                Eventos e compromissos marcados
              </p>
            </div>

            {/* Listagem de eventos do dia */}
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[300px]">
              {selectedDateEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <Info size={24} className="text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400 max-w-[180px] leading-relaxed">
                    Nenhum compromisso marcado para este dia.
                  </p>
                </div>
              ) : (
                selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-gray-100 p-4 bg-white flex justify-between items-start"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-700 leading-snug">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] bg-gray-100 text-gray-500 rounded font-semibold px-2 py-0.5 uppercase">
                          {event.discipline}
                        </span>
                        <span className={`text-[10px] border rounded font-bold px-2 py-0.5 ${typeLabels[event.type]}`}>
                          {event.type}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-gray-300 hover:text-red-500 transition cursor-pointer p-1"
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Botão / Form para Adicionar Evento */}
            {showAddModal ? (
              <form onSubmit={handleAddEvent} className="border-t border-gray-100 pt-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Novo Compromisso</p>
                
                <input
                  type="text"
                  placeholder="Nome do evento/prova..."
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#29645e] transition"
                  required
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newEventDiscipline}
                    onChange={(e) => setNewEventDiscipline(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 outline-none focus:border-[#29645e] cursor-pointer transition bg-white"
                  >
                    {disciplinesList.map((disc) => (
                      <option key={disc} value={disc}>
                        {disc}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as "Prova" | "Trabalho" | "Estudo")}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 outline-none focus:border-[#29645e] cursor-pointer transition bg-white"
                  >
                    <option value="Prova">Prova</option>
                    <option value="Trabalho">Trabalho</option>
                    <option value="Estudo">Estudo</option>
                  </select>
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-[#29645e] py-2.5 text-white hover:bg-[#1e4b47] transition duration-200 text-xs font-semibold cursor-pointer active:scale-95"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-gray-500 hover:bg-gray-50 transition duration-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full rounded-xl bg-[#29645e] py-3 text-white hover:bg-[#1e4b47] transition duration-200 flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer active:scale-95"
                type="button"
              >
                <Plus size={18} />
                Adicionar Evento para Dia {selectedDate.split("-")[2]}
              </button>
            )}
          </div>
          
        </section>
      </main>
    </div>
  );
}

