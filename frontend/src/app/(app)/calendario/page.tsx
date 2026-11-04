/**
 * Página do Calendário Acadêmico do aplicativo Study Flow.
 * Esta tela exibe uma grade mensal (Junho de 2026), lista os compromissos
 * associados ao dia selecionado e permite criar, visualizar e deletar eventos
 * (Provas, Trabalhos e Estudos), persistindo os dados no localStorage do usuário.
 * @packageDocumentation
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState, PageLoading } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

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
  avatar_url?: string | null;
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
  disciplineId?: string | null;
  /** Faixa de horário opcional (ex.: "19:00 – 19:50"), usada nos blocos de estudo */
  time?: string;
  /** Tipo do evento para categorização e estilo visual */
  type: "Prova" | "Trabalho" | "Estudo" | "Atividade" | string;
};

type DisciplineOption = {
  id: string;
  name: string;
};

/** Prova ou trabalho guardado nas anotacoes da disciplina */
type ProvaNota = { id?: string; nome?: string; data?: string };

/** Formato das anotacoes (JSON) salvas em cada disciplina */
type AnotacoesDisciplina = {
  provas?: ProvaNota[];
  trabalhos?: ProvaNota[];
  examDate?: string;
  workDate?: string;
};

/** Disciplina salva no localStorage (modo sem login Supabase) */
type DisciplinaLocal = {
  id: string;
  name: string;
  date?: string;
  examDate?: string;
  workDate?: string;
  provas?: ProvaNota[];
  trabalhos?: ProvaNota[];
};


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
function CalendarioConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Sessão do usuário logado ou null se não autenticado */
  const [user, setUser] = useState<UserSession | null>(null);



  /** Lista completa de eventos carregados do usuário atual */
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  const [disciplineOptions, setDisciplineOptions] = useState<DisciplineOption[]>([]);

  // ?data=AAAA-MM-DD abre o calendário num dia específico (ex.: vindo da tela de rotina).
  const dataInicial = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("data") ?? "") ? searchParams.get("data")! : null;

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    if (!dataInicial) return new Date();
    const [ano, mes] = dataInicial.split("-").map(Number);
    return new Date(ano, mes - 1, 1);
  });

  /** Data atualmente selecionada no calendário (padrão dia de hoje) */
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (dataInicial) return dataInicial;
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
  });

  const prevMonth = () => {
    setCurrentMonthDate((curr) => new Date(curr.getFullYear(), curr.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate((curr) => new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
  };

  /** Título para o novo evento a ser criado no formulário */
  const [newEventTitle, setNewEventTitle] = useState("");

  /** Disciplina selecionada para o novo evento no formulário */
  const [newEventDiscipline, setNewEventDiscipline] = useState("");

  /** Tipo do novo evento selecionado no formulário */
  const [newEventType, setNewEventType] = useState<"Prova" | "Trabalho" | "Estudo">("Prova");

  /** Controla a exibição do formulário de adição rápida de eventos */
  const [showAddModal, setShowAddModal] = useState(false);

  /**
   * Efeito executado ao montar o componente.
   * Verifica a autenticação do usuário. Se válido, carrega os dados de sessão
   * e busca os eventos persistidos no Supabase e/ou localStorage.
   */
  const loadCalendar = async () => {
    const parsedSession = getStoredSession();

    if (!parsedSession) {
      router.push("/");
      return;
    }

    try {
      const currentUserId = await getCurrentSupabaseUserId(parsedSession);
      setUser(parsedSession);
      setSupabaseUserId(currentUserId);

      if (!currentUserId) {
        const storedEvents = localStorage.getItem(`studyflow_events_${parsedSession.email}`);
        const storedSubjects = localStorage.getItem(`studyflow_subjects_${parsedSession.email}`);
        const storedActivities = localStorage.getItem(`studyflow_activities_${parsedSession.email}`);

        const localSubjects = storedSubjects
          ? (JSON.parse(storedSubjects) as DisciplinaLocal[]).map((subject) => ({
              id: subject.id,
              name: subject.name,
            }))
          : disciplinesList.map((name) => ({ id: name, name }));
        setDisciplineOptions(localSubjects);
        setNewEventDiscipline(localSubjects[0]?.id || "");

        const combined: CalendarEvent[] = storedEvents ? JSON.parse(storedEvents) : [];

        // Atividades locais
        if (storedActivities) {
          const acts = JSON.parse(storedActivities) as Array<{ id: string; name: string; date: string }>;
          acts.forEach((a) => {
            if (a.date && !combined.some((c) => c.id === a.id)) {
              combined.push({
                id: a.id,
                title: a.name,
                date: a.date,
                discipline: "Atividade",
                type: "Atividade",
              });
            }
          });
        }

        // Provas e Trabalhos de disciplinas locais
        if (storedSubjects) {
          const subs = JSON.parse(storedSubjects) as DisciplinaLocal[];
          subs.forEach((s) => {
            if (s.date && !combined.some((c) => c.id === `disc-${s.id}`)) {
              combined.push({
                id: `disc-${s.id}`,
                title: `Aula: ${s.name}`,
                date: s.date,
                discipline: s.name,
                disciplineId: s.id,
                type: "Estudo",
              });
            }
            if (Array.isArray(s.provas)) {
              s.provas.forEach((p, idx: number) => {
                if (p?.data) {
                  combined.push({
                    id: p.id || `prova-${s.id}-${idx}`,
                    title: p.nome || `Prova - ${s.name}`,
                    date: p.data,
                    discipline: s.name,
                    disciplineId: s.id,
                    type: "Prova",
                  });
                }
              });
            } else if (s.examDate) {
              combined.push({
                id: `prova-${s.id}`,
                title: `Prova - ${s.name}`,
                date: s.examDate,
                discipline: s.name,
                disciplineId: s.id,
                type: "Prova",
              });
            }
            if (Array.isArray(s.trabalhos)) {
              s.trabalhos.forEach((t, idx: number) => {
                if (t?.data) {
                  combined.push({
                    id: t.id || `trab-${s.id}-${idx}`,
                    title: t.nome || `Trabalho - ${s.name}`,
                    date: t.data,
                    discipline: s.name,
                    disciplineId: s.id,
                    type: "Trabalho",
                  });
                }
              });
            } else if (s.workDate) {
              combined.push({
                id: `trab-${s.id}`,
                title: `Trabalho - ${s.name}`,
                date: s.workDate,
                discipline: s.name,
                disciplineId: s.id,
                type: "Trabalho",
              });
            }
          });
        }

        setEvents(combined);
        return;
      }

      const [{ data: disciplinas }, { data: itens }] = await Promise.all([
        supabase
          .from("disciplinas")
          .select("id,nome,data_inicio,data_fim,anotacoes")
          .eq("user_id", currentUserId)
          .order("created_at"),
        supabase
          .from("itens_cronograma")
          .select("id,nome,tipo,data_inicio,data_fim,disciplina_id,disciplinas(nome)")
          .eq("user_id", currentUserId)
          .order("data_inicio", { ascending: true }),
      ]);

      const remoteSubjects = (disciplinas ?? []).map((disciplina) => ({ id: disciplina.id, name: disciplina.nome }));
      setDisciplineOptions(remoteSubjects);
      setNewEventDiscipline((current) => current || remoteSubjects[0]?.id || "");

      const combinedEvents: CalendarEvent[] = [];

      // 1. Itens do Cronograma (estudo, atividades, etc.)
      (itens ?? []).forEach((item) => {
        const disciplina = Array.isArray(item.disciplinas) ? item.disciplinas[0] : item.disciplinas;
        const isAtiv = String(item.tipo).toLowerCase() === "atividade";
        const isEstudo = String(item.tipo).toLowerCase() === "estudo";
        const inicioHora = item.data_inicio ? String(item.data_inicio).slice(11, 16) : "";
        const fimHora = item.data_fim ? String(item.data_fim).slice(11, 16) : "";
        combinedEvents.push({
          time: isEstudo && inicioHora && fimHora ? `${inicioHora} – ${fimHora}` : undefined,
          date: item.data_inicio ? String(item.data_inicio).slice(0, 10) : item.data_fim ? String(item.data_fim).slice(0, 10) : new Date().toISOString().slice(0, 10),
          discipline: disciplina?.nome ?? (isAtiv ? "Atividade" : "Geral"),
          disciplineId: item.disciplina_id,
          id: item.id,
          title: item.nome,
          type: isAtiv ? "Atividade" : isEstudo ? "Estudo" : item.tipo,
        });
      });

      // 2. Disciplinas e suas Provas e Trabalhos
      (disciplinas ?? []).forEach((disc) => {
        if (disc.data_inicio) {
          combinedEvents.push({
            date: String(disc.data_inicio).slice(0, 10),
            discipline: disc.nome,
            disciplineId: disc.id,
            id: `disc-${disc.id}`,
            title: `Aula: ${disc.nome}`,
            type: "Estudo",
          });
        }

        const notesObj: AnotacoesDisciplina = typeof disc.anotacoes === "object" && disc.anotacoes !== null ? (disc.anotacoes as AnotacoesDisciplina) : {};

        if (Array.isArray(notesObj.provas)) {
          notesObj.provas.forEach((p, idx: number) => {
            if (p?.data) {
              combinedEvents.push({
                date: String(p.data).slice(0, 10),
                discipline: disc.nome,
                disciplineId: disc.id,
                id: p.id || `disc-prova-${disc.id}-${idx}`,
                title: p.nome || `Prova - ${disc.nome}`,
                type: "Prova",
              });
            }
          });
        } else if (notesObj.examDate) {
          combinedEvents.push({
            date: String(notesObj.examDate).slice(0, 10),
            discipline: disc.nome,
            disciplineId: disc.id,
            id: `disc-exam-${disc.id}`,
            title: `Prova - ${disc.nome}`,
            type: "Prova",
          });
        }

        if (Array.isArray(notesObj.trabalhos)) {
          notesObj.trabalhos.forEach((t, idx: number) => {
            if (t?.data) {
              combinedEvents.push({
                date: String(t.data).slice(0, 10),
                discipline: disc.nome,
                disciplineId: disc.id,
                id: t.id || `disc-trab-${disc.id}-${idx}`,
                title: t.nome || `Trabalho - ${disc.nome}`,
                type: "Trabalho",
              });
            }
          });
        } else if (notesObj.workDate) {
          combinedEvents.push({
            date: String(notesObj.workDate).slice(0, 10),
            discipline: disc.nome,
            disciplineId: disc.id,
            id: `disc-work-${disc.id}`,
            title: `Trabalho - ${disc.nome}`,
            type: "Trabalho",
          });
        }
      });

      setEvents(combinedEvents);
    } catch {
      localStorage.removeItem("studyflow_session");
      router.push("/");
    }
  };

  useEffect(() => {
    // Carga assíncrona: os setState de loadCalendar ocorrem após o await, não em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCalendar();
    // loadCalendar é recriada a cada render; a carga deve rodar só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /**
   * Atualiza a lista de eventos no estado local e os persiste no localStorage.
   *
   * @param updatedEvents - Nova lista completa de eventos
   */
  const saveEvents = (updatedEvents: CalendarEvent[]) => {
    setEvents(updatedEvents);
    if (user && !supabaseUserId) {
      localStorage.setItem(`studyflow_events_${user.email}`, JSON.stringify(updatedEvents));
    }
  };

  /**
   * Lida com o fluxo de submissão do formulário para adicionar um novo compromisso.
   * Cria um objeto {@link CalendarEvent} com dados preenchidos, anexa à lista e persiste.
   *
   * @param e - Evento de envio do formulário React
   */
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    if (supabaseUserId) {
      const selectedDiscipline = disciplineOptions.find((discipline) => discipline.id === newEventDiscipline);
      const { data } = await supabase
        .from("itens_cronograma")
        .insert({
          data_fim: `${selectedDate}T10:00:00`,
          data_inicio: `${selectedDate}T09:00:00`,
          disciplina_id: selectedDiscipline?.id || null,
          nome: newEventTitle.trim(),
          tipo: newEventType,
          user_id: supabaseUserId,
        })
        .select("id")
        .single();

      if (!data) return;

      saveEvents([
        ...events,
        {
          date: selectedDate,
          discipline: selectedDiscipline?.name || "Sem disciplina",
          disciplineId: selectedDiscipline?.id || null,
          id: data.id,
          title: newEventTitle.trim(),
          type: newEventType,
        },
      ]);
      setNewEventTitle("");
      setShowAddModal(false);
      return;
    }

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: newEventTitle.trim(),
      date: selectedDate,
      discipline: disciplineOptions.find((discipline) => discipline.id === newEventDiscipline)?.name || "Sem disciplina",
      disciplineId: newEventDiscipline || null,
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
  const handleDeleteEvent = async (id: string) => {
    if (supabaseUserId) {
      await supabase.from("itens_cronograma").delete().eq("id", id).eq("user_id", supabaseUserId);
    }

    const updatedEvents = events.filter((e) => e.id !== id);
    saveEvents(updatedEvents);
  };

  if (!user) {
    return <PageLoading label="Carregando calendário..." />;
  }

  // Geração dinâmica da grade do calendário
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Domingo, 1 = Segunda
  const startDayOffset = (firstDay + 6) % 7; // Segunda-feira = 0, ..., Domingo = 6
  const calendarCells: (number | null)[] = [];

  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push(null);
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    calendarCells.push(day);
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  // Eventos da data selecionada
  const selectedDateEvents = events.filter((e) => e.date === selectedDate);

  const selectedLabel = (() => {
    const parts = selectedDate.split("-");
    if (parts.length !== 3) return "Dia selecionado";
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${Number(parts[2])} de ${monthNames[Number(parts[1]) - 1]?.toLowerCase() ?? ""}`;
  })();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button onClick={() => void loadCalendar()} title="Buscar compromissos atualizados" variant="secondary">
              <RefreshCw aria-hidden size={16} />
              Atualizar
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus aria-hidden size={18} />
              Novo compromisso
            </Button>
          </>
        }
        description="Provas, trabalhos, atividades e blocos de estudo do cronograma em um só lugar."
        title="Calendário"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Grade do mês */}
        <Card className="!p-3 sm:!p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <h2 className="text-lg font-semibold text-ink-900" aria-live="polite">
              {monthNames[month]} <span className="font-normal text-ink-500">{year}</span>
            </h2>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => {
                  setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(todayStr);
                }}
                size="sm"
                variant="ghost"
              >
                Hoje
              </Button>
              <Button aria-label="Mês anterior" onClick={prevMonth} size="icon-sm" variant="secondary">
                <ChevronLeft size={16} />
              </Button>
              <Button aria-label="Próximo mês" onClick={nextMonth} size="icon-sm" variant="secondary">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-medium text-ink-500" aria-hidden>
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-px">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div className="h-14 sm:h-20 lg:h-24" key={`empty-${idx}`} />;
              }

              const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === todayStr;
              const dayEvents = events.filter((e) => e.date === dateStr);

              return (
                <button
                  aria-label={`${day} de ${monthNames[month]}${dayEvents.length ? `: ${dayEvents.map((e) => e.title).join(", ")}` : ""}`}
                  aria-pressed={isSelected}
                  className={`flex h-14 flex-col items-center gap-1 rounded-[10px] p-1 text-left transition-colors sm:h-20 sm:items-stretch sm:p-1.5 lg:h-24 ${
                    isSelected ? "bg-primary-50 ring-2 ring-inset ring-primary-500" : "hover:bg-ink-50"
                  }`}
                  key={`day-${day}`}
                  onClick={() => setSelectedDate(dateStr)}
                  type="button"
                >
                  <span
                    className={`tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${
                      isToday ? "bg-primary-700 text-white" : isSelected ? "text-primary-800" : "text-ink-700"
                    }`}
                  >
                    {day}
                  </span>

                  {/* Celular: pontinhos */}
                  <span className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden>
                    {dayEvents.slice(0, 3).map((event) => (
                      <span className={`h-1.5 w-1.5 rounded-full ${styleFor(event.type).dot ?? "bg-primary-600"}`} key={event.id} />
                    ))}
                  </span>

                  {/* Tablet e desktop: títulos */}
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden>
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        className={`truncate rounded-[4px] px-1.5 py-px text-[11px] font-medium leading-4 ${styleFor(event.type).chip ?? "bg-primary-100 text-primary-800"}`}
                        key={event.id}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 ? <span className="px-1.5 text-[11px] font-medium text-ink-500">+{dayEvents.length - 2} mais</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-1 pt-3 text-xs text-ink-500">
            {Object.entries(typeStyles).map(([type, style]) => (
              <li className="flex items-center gap-1.5" key={type}>
                <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                {type}
              </li>
            ))}
          </ul>
        </Card>

        {/* Detalhes do dia */}
        <Card className="flex flex-col lg:col-span-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink-900">{selectedLabel}</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              {selectedDateEvents.length === 0
                ? "Nada marcado"
                : `${selectedDateEvents.length} ${selectedDateEvents.length === 1 ? "compromisso" : "compromissos"}`}
            </p>
          </div>

          {selectedDateEvents.length === 0 ? (
            <EmptyState
              className="flex-1 !py-8"
              description="Use o botão abaixo para marcar uma prova, trabalho ou sessão de estudo."
              icon={<CalendarDays size={22} />}
              title="Dia livre"
            />
          ) : (
            <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
              {selectedDateEvents.map((event) => (
                <li className="flex items-start gap-3 rounded-control border border-line p-3" key={event.id}>
                  <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${styleFor(event.type).dot ?? "bg-primary-600"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-ink-900">{event.title}</p>
                    {event.time ? <p className="tabular mt-0.5 text-xs text-ink-500">{event.time}</p> : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={styleFor(event.type).tone ?? "neutral"}>{labelFor(event.type)}</Badge>
                      <Badge>{event.discipline}</Badge>
                    </div>
                  </div>
                  <Button aria-label={`Excluir ${event.title}`} onClick={() => handleDeleteEvent(event.id)} size="icon-sm" variant="danger-ghost">
                    <Trash2 size={15} />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button className="mt-4 w-full" onClick={() => setShowAddModal(true)} variant="secondary">
            <Plus aria-hidden size={18} />
            Adicionar neste dia
          </Button>
        </Card>
      </div>

      {showAddModal ? (
        <Modal
          description={selectedLabel}
          footer={
            <>
              <Button onClick={() => setShowAddModal(false)} variant="secondary">
                Cancelar
              </Button>
              <Button form="form-compromisso" type="submit">
                Salvar
              </Button>
            </>
          }
          onClose={() => setShowAddModal(false)}
          title="Novo compromisso"
        >
          <form className="grid gap-4" id="form-compromisso" onSubmit={handleAddEvent}>
            <Field htmlFor="evento-titulo" label="Nome">
              <Input
                id="evento-titulo"
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="Ex.: Prova P1"
                required
                type="text"
                value={newEventTitle}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field htmlFor="evento-tipo" label="Tipo">
                <Select id="evento-tipo" onChange={(e) => setNewEventType(e.target.value as "Prova" | "Trabalho" | "Estudo")} value={newEventType}>
                  <option value="Prova">Prova</option>
                  <option value="Trabalho">Trabalho</option>
                  <option value="Estudo">Estudo</option>
                </Select>
              </Field>
              <Field htmlFor="evento-disciplina" label="Disciplina">
                <Select id="evento-disciplina" onChange={(e) => setNewEventDiscipline(e.target.value)} value={newEventDiscipline}>
                  <option value="">Sem disciplina</option>
                  {disciplineOptions.map((disc) => (
                    <option key={disc.id} value={disc.id}>
                      {disc.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field htmlFor="evento-data" label="Data">
              <Input id="evento-data" onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  setSelectedDate(value);
                  const [y, m] = value.split("-").map(Number);
                  setCurrentMonthDate(new Date(y, m - 1, 1));
                }} required type="date" value={selectedDate} />
            </Field>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/** Cores por tipo de compromisso (mesmas famílias no app mobile). */
const typeStyles: Record<string, { dot: string; chip: string; tone: "danger" | "gold" | "success" | "primary" }> = {
  Prova: { dot: "bg-danger", chip: "bg-danger-soft text-[#9b2a24]", tone: "danger" },
  Trabalho: { dot: "bg-gold", chip: "bg-gold-soft text-[#7a5408]", tone: "gold" },
  Estudo: { dot: "bg-success", chip: "bg-success-soft text-[#0b6b4a]", tone: "success" },
  Atividade: { dot: "bg-primary-600", chip: "bg-primary-100 text-primary-800", tone: "primary" },
};

// useSearchParams exige um limite de Suspense para a rota continuar pré-renderizada.
export default function CalendarioPage() {
  return (
    <Suspense fallback={null}>
      <CalendarioConteudo />
    </Suspense>
  );
}

/** Normaliza o tipo vindo do banco ("entrega", "prova"...) para as categorias exibidas. */
function labelFor(type: string) {
  const value = String(type).toLowerCase();
  if (value === "prova") return "Prova";
  if (value === "trabalho" || value === "entrega") return value === "entrega" ? "Entrega" : "Trabalho";
  if (value === "estudo") return "Estudo";
  if (value === "atividade") return "Atividade";
  return type ? `${String(type).charAt(0).toUpperCase()}${String(type).slice(1)}` : "Compromisso";
}

function styleFor(type: string) {
  const value = String(type).toLowerCase();
  if (value === "prova") return typeStyles.Prova;
  if (value === "trabalho" || value === "entrega") return typeStyles.Trabalho;
  if (value === "estudo") return typeStyles.Estudo;
  return typeStyles.Atividade;
}
