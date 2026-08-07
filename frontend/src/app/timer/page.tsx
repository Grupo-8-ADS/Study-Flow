"use client";

import type { NextPage } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Calendar,
  Activity,
  BookOpen,
  Timer as TimerIcon,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  User,
  Play,
  Pause,
  RotateCcw,
  Book,
  ClipboardList,
  Gift
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";

interface UserSession {
  demoMode?: boolean;
  email: string;
  nome: string;
  username: string;
}

type DisciplineOption = { id: string; name: string };

const TimerDashboard: NextPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const activeTab = "Timer";
  
  // Notificações dropdown
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([
    "Bem-vindo ao Study Flow! Comece sua primeira sessão.",
    "Dica: Faça pausas regulares para manter o foco."
  ]);

  // Pomodoro Timer States
  const [timerType, setTimerType] = useState<"foco" | "pausa_curta" | "pausa_longa">("foco");
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [totalDuration, setTotalDuration] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Disciplinas & Notas
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("");
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");

  // Redirecionamento caso não autenticado e carregamento de sessão
  useEffect(() => {
    async function loadTimer() {
      const parsed = getStoredSession();

      if (!parsed) {
        router.push("/");
        return;
      }

      setUser(parsed);

      const currentUserId = await getCurrentSupabaseUserId(parsed);
      setSupabaseUserId(currentUserId);

      if (!currentUserId) {
        const saved = localStorage.getItem(`studyflow_subjects_${parsed.email}`);
        const localDisciplines = saved
          ? (JSON.parse(saved) as Array<{ id: string; name: string }>).map((subject) => ({ id: subject.id, name: subject.name }))
          : [];
        setDisciplines(localDisciplines);
        setSelectedDiscipline(localDisciplines[0]?.id ?? "");
        return;
      }

      const { data } = await supabase.from("disciplinas").select("id,nome").eq("user_id", currentUserId).order("created_at");
      const remoteDisciplines = (data ?? []).map((disciplina) => ({ id: disciplina.id, name: disciplina.nome }));
      setDisciplines(remoteDisciplines);
      setSelectedDiscipline(remoteDisciplines[0]?.id ?? "");
    }

    void loadTimer();
  }, [router]);

  // Sincroniza anotações ao mudar de disciplina ou usuário
  useEffect(() => {
    if (user && selectedDiscipline) {
      const storedNotes = localStorage.getItem(`studyflow_notes_${user.email}_${selectedDiscipline}`);
      setTimeout(() => {
        setNotes(storedNotes || "");
      }, 0);
    }
  }, [user, selectedDiscipline]);

  // Salva anotações no localStorage
  const handleNotesChange = (text: string) => {
    setNotes(text);
    if (user && selectedDiscipline) {
      localStorage.setItem(`studyflow_notes_${user.email}_${selectedDiscipline}`, text);
    }
  };

  const getSelectedDisciplineName = useCallback(() => {
    return disciplines.find((discipline) => discipline.id === selectedDiscipline)?.name ?? "Sem disciplina";
  }, [disciplines, selectedDiscipline]);

  const recordStudySession = useCallback(async () => {
    if (!user || timerType !== "foco") return;

    const durationMinutes = Math.round(totalDuration / 60);
    const finishedAt = new Date();
    const startedAt = new Date(finishedAt.getTime() - totalDuration * 1000);

    if (supabaseUserId) {
      await supabase.from("sessoes_estudo").insert({
        data_fim: finishedAt.toISOString(),
        data_inicio: startedAt.toISOString(),
        disciplina_id: selectedDiscipline || null,
        duracao_efetiva_min: durationMinutes,
        exp: durationMinutes,
        notas: notes,
        status: "concluida",
        user_id: supabaseUserId,
      });
      return;
    }

    const key = `studyflow_activity_${user.email}`;
    const current = localStorage.getItem(key);
    const activity = current ? JSON.parse(current) : [];
    activity.push({
      createdAt: finishedAt.toISOString(),
      discipline: getSelectedDisciplineName(),
      minutes: durationMinutes,
      type: "foco",
    });
    localStorage.setItem(key, JSON.stringify(activity));
  }, [getSelectedDisciplineName, notes, selectedDiscipline, supabaseUserId, timerType, totalDuration, user]);

  // Ajusta o tempo inicial com base no tipo de timer selecionado
  const getInitialTime = (type: "foco" | "pausa_curta" | "pausa_longa") => {
    switch (type) {
      case "foco":
        return 25 * 60;
      case "pausa_curta":
        return 5 * 60;
      case "pausa_longa":
        return 15 * 60;
    }
  };

  // Muda a aba do Timer (Foco, Pausa Curta, Pausa Longa)
  const handleTimerTypeChange = (type: "foco" | "pausa_curta" | "pausa_longa") => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    setTimerType(type);
    const duration = getInitialTime(type);
    setSecondsLeft(duration);
    setTotalDuration(duration);
  };

  // Iniciar/Pausar cronômetro
  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  // Resetar cronômetro
  const resetTimer = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const duration = getInitialTime(timerType);
    setSecondsLeft(duration);
  };

  // Efeito principal do Timer (Intervalo de 1 segundo)
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            
            // Adiciona notificação de término
            void recordStudySession();

            const notificationMsg = timerType === "foco" 
              ? `Sessão de foco em "${getSelectedDisciplineName()}" finalizada! Hora de uma pausa.` 
              : "Sua pausa acabou! Pronto para voltar ao foco?";
            
            setNotifications(prevNotif => [notificationMsg, ...prevNotif]);
            alert(notificationMsg);
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [getSelectedDisciplineName, isRunning, recordStudySession, timerType]);

  // Função de logout
  const handleLogout = () => {
    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

  // Formatação de minutos/segundos (MM:SS)
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Cálculo do progresso circular do timer (SVG)
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalDuration > 0 
    ? circumference - (secondsLeft / totalDuration) * circumference 
    : 0;

  // Renderizador da Barra Lateral (Sidebar)
  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Calendário", href: "/calendario", icon: Calendar },
    { name: "Atividade", href: "/atividade", icon: Activity },
    { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
    { name: "Timer", href: "/timer", icon: TimerIcon },
    { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
    { name: "Recompensas", href: "/rewards", icon: Gift },
    { name: "Configurações", href: "/configuracoes", icon: Settings },
  ];

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f2fcfb]">
        <div className="text-xl font-medium text-[#29645e] animate-pulse">Carregando painel...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f7fdfd] font-[Roboto]">
      {/* SIDEBAR LATERAL */}
      <aside className="w-full lg:w-[260px] bg-[#29645e] text-white flex flex-col justify-between py-6 px-4 shrink-0 shadow-lg select-none">
        <div className="flex flex-col gap-8">
          {/* Logo Study Flow */}
          <div className="flex items-center gap-3 px-2">
            <h1 className="text-2xl font-normal font-['Rubik_Bubbles'] tracking-wider">
              Study Flow
            </h1>
          </div>

          {/* Opções de Navegação */}
          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 py-3 px-4 rounded-[15px] text-base font-medium transition duration-200 cursor-pointer ${
                    isActive
                      ? "bg-white text-[#29645e] shadow-md scale-[1.02]"
                      : "hover:bg-[#347871] text-gray-100 hover:text-white"
                  }`}
                >
                  <Icon size={20} className="shrink-0" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Botão Sair */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 py-3 px-4 rounded-[15px] text-base font-medium text-red-200 hover:bg-[#a83232] hover:text-white transition duration-200 cursor-pointer mt-8"
        >
          <LogOut size={20} className="shrink-0" />
          <span>Sair</span>
        </button>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto px-4 lg:px-8 py-6">
        {/* HEADER DE AÇÕES */}
        <header className="flex items-center justify-between pb-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">
              {activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* ÍCONE DE NOTIFICAÇÕES */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                }}
                className="p-2.5 rounded-full bg-white border border-gray-100 shadow-sm text-gray-600 hover:text-[#29645e] hover:bg-[#eaf6f4] transition cursor-pointer relative"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                )}
              </button>

              {/* Popover Notificações */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 z-50 animate-fade-in">
                  <div className="px-4 pb-2 border-b border-gray-100 font-semibold text-gray-700 text-sm">
                    Notificações
                  </div>
                  <div className="max-h-60 overflow-y-auto mt-2">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">
                        Nenhuma notificação por enquanto.
                      </div>
                    ) : (
                      notifications.map((notif, index) => (
                        <div key={index} className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 border-b border-gray-50 last:border-0 leading-relaxed">
                          {notif}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AVATAR DO USUÁRIO */}
            <div className="relative">
              <button
                aria-label="Abrir perfil"
                onClick={() => router.push("/perfil")}
                className="flex items-center justify-center p-2 rounded-full border border-gray-200 bg-[#eaf6f4] text-[#29645e] hover:border-[#29645e] transition cursor-pointer w-10 h-10 shadow-sm"
                type="button"
              >
                <User size={22} />
              </button>
            </div>
          </div>
        </header>

        {/* CONTEÚDO CORRESPONDENTE À ABA SELECIONADA */}
        <section className="flex-1 flex flex-col justify-start mt-6">
          {activeTab === "Timer" ? (
            /* CONTEÚDO DO POMODORO */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Temporizador Pomodoro */}
              <div className="lg:col-span-7 bg-white p-6 lg:p-8 rounded-[30px] shadow-[0px_4px_25px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col items-center">
                
                {/* Abas de Tempo */}
                <div className="flex gap-2 p-1.5 bg-[#eaf6f4] rounded-full max-w-md w-full mb-8">
                  {(["foco", "pausa_curta", "pausa_longa"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTimerTypeChange(type)}
                      className={`flex-1 py-2 text-center text-sm font-semibold rounded-full capitalize transition-all duration-300 cursor-pointer ${
                        timerType === type
                          ? "bg-[#29645e] text-white shadow-md"
                          : "text-gray-600 hover:text-[#29645e]"
                      }`}
                    >
                      {type === "foco" ? "Foco" : type === "pausa_curta" ? "Pausa Curta" : "Pausa Longa"}
                    </button>
                  ))}
                </div>

                {/* Display Circular */}
                <div className="relative flex items-center justify-center w-[230px] h-[230px] select-none">
                  {/* Círculo de Background e Progresso */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="115"
                      cy="115"
                      r={radius}
                      className="stroke-gray-100 fill-transparent"
                      strokeWidth="8"
                    />
                    <circle
                      cx="115"
                      cy="115"
                      r={radius}
                      className="stroke-[#29645e] fill-transparent transition-all duration-1000 ease-linear"
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Texto do Timer */}
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl lg:text-5xl font-bold font-mono text-[#29645e]">
                      {formatTime(secondsLeft)}
                    </span>
                    <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 mt-1">
                      {timerType === "foco" ? "Foco" : "Pausa"}
                    </span>
                  </div>
                </div>

                {/* Controles de Play / Pause / Reset */}
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={toggleTimer}
                    className="p-4 rounded-full bg-[#29645e] text-white shadow-lg hover:bg-[#1e4b47] hover:scale-105 active:scale-95 transition cursor-pointer"
                  >
                    {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="p-4 rounded-full bg-white border border-gray-200 text-gray-500 shadow-md hover:text-[#29645e] hover:border-[#29645e] hover:scale-105 active:scale-95 transition cursor-pointer"
                  >
                    <RotateCcw size={24} />
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Seleção de Disciplina e Bloco de Notas */}
              <div className="lg:col-span-5 flex flex-col gap-6 w-full">
                
                {/* Seleção de Disciplinas */}
                <div className="bg-white p-6 rounded-[25px] shadow-[0px_4px_25px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-gray-700 font-semibold text-base">
                    <Book size={18} className="text-[#29645e]" />
                    <span>Selecione a Disciplina</span>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedDiscipline}
                      onChange={(e) => setSelectedDiscipline(e.target.value)}
                      className="w-full bg-[#eaf6f4] border-none outline-none rounded-xl text-base text-gray-700 py-3 px-4 appearance-none cursor-pointer focus:ring-2 focus:ring-[#29645e] transition"
                    >
                      <option value="">Sem disciplina</option>
                      {disciplines.map((discipline) => (
                        <option key={discipline.id} value={discipline.id}>
                          {discipline.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Bloco de Anotações */}
                <div className="bg-white p-6 rounded-[25px] shadow-[0px_4px_25px_rgba(0,0,0,0.02)] border border-gray-100 flex-1 flex flex-col gap-3 min-h-[300px]">
                  <div className="flex items-center gap-2 text-gray-700 font-semibold text-base">
                    <ClipboardList size={18} className="text-[#29645e]" />
                    <span>Notas de Estudo</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder={`Escreva suas notas e anotações aqui para "${getSelectedDisciplineName()}"... Suas anotações serão salvas automaticamente.`}
                    className="flex-1 w-full bg-[#fcfdfd] border border-gray-200 focus:border-[#29645e] rounded-2xl outline-none p-4 text-sm text-gray-700 resize-none leading-relaxed transition"
                  />
                  <div className="text-right text-[10px] text-gray-400 font-medium italic">
                    Salvo automaticamente no navegador
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* DEMAIS ABAS EM BRANCO CONFORME PLANO DE IMPLEMENTAÇÃO */
            <div className="w-full flex-1 bg-white border border-gray-100 shadow-[0px_4px_25px_rgba(0,0,0,0.01)] rounded-[30px] p-8 flex items-center justify-center min-h-[450px]">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#eaf6f4] text-[#29645e] flex items-center justify-center mx-auto mb-4">
                  <ClipboardList size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{activeTab}</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  A seção de {activeTab} está em branco para desenvolvimento futuro de funcionalidades específicas.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default TimerDashboard;
