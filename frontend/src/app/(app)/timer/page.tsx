"use client";

import type { NextPage } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { BookOpen, NotebookPen, Pause, Play, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageLoading } from "@/components/ui/feedback";
import { Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";

interface UserSession {
  email: string;
  nome: string;
  username: string;
  avatar_url?: string | null;
}

type DisciplineOption = { id: string; name: string };

const TimerDashboard: NextPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  

  // Pomodoro Timer States
  const [timerType, setTimerType] = useState<"foco" | "pausa_curta" | "pausa_longa">("foco");
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  // Fonte da verdade para o intervalo: atualizada junto com o estado (sincronizar via
  // efeito sobrescreveria ticks mais novos com um valor antigo).
  const secondsLeftRef = useRef(25 * 60);
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

      const [{ data }, { data: profile }] = await Promise.all([
        supabase.from("disciplinas").select("id,nome").eq("user_id", currentUserId).order("created_at"),
        supabase.from("profiles").select("avatar_url").eq("id", currentUserId).maybeSingle(),
      ]);

      if (profile?.avatar_url) {
        setUser((curr) => curr ? { ...curr, avatar_url: profile.avatar_url } : null);
      }

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
    secondsLeftRef.current = duration;
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
    secondsLeftRef.current = duration;
  };

  // Término do ciclo: registra a sessão e notifica (chamado uma única vez por ciclo)
  const finishCycle = useCallback(() => {
    void recordStudySession();

    const notificationMsg = timerType === "foco"
      ? `Sessão de foco em "${getSelectedDisciplineName()}" finalizada! Hora de uma pausa.`
      : "Sua pausa acabou! Pronto para voltar ao foco?";
    alert(notificationMsg);
  }, [getSelectedDisciplineName, recordStudySession, timerType]);

  // Ref com o callback mais recente, lido pelo intervalo sem recriá-lo a cada render
  const finishCycleRef = useRef(finishCycle);
  useEffect(() => {
    finishCycleRef.current = finishCycle;
  }, [finishCycle]);

  // Efeito principal do Timer (Intervalo de 1 segundo)
  useEffect(() => {
    if (isRunning) {
      // Efeitos colaterais ficam fora do updater do setState: o React pode executá-lo
      // duas vezes (StrictMode), o que gravava a sessão em dobro.
      timerRef.current = setInterval(() => {
        const next = Math.max(secondsLeftRef.current - 1, 0);
        secondsLeftRef.current = next;
        setSecondsLeft(next);

        if (next === 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsRunning(false);
          finishCycleRef.current();
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Formatação de minutos/segundos (MM:SS)
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Cálculo do progresso circular do timer (SVG)
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalDuration > 0 ? circumference - (secondsLeft / totalDuration) * circumference : 0;

  if (!user) {
    return <PageLoading label="Carregando timer..." />;
  }

  const modeLabels = { foco: "Foco", pausa_curta: "Pausa curta", pausa_longa: "Pausa longa" } as const;

  return (
    <>
      <PageHeader
        description="Use ciclos Pomodoro: 25 minutos de foco e pausas curtas. Ao terminar um ciclo de foco, a sessão entra nas suas estatísticas."
        title="Timer"
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <Card className="flex flex-col items-center !py-8 lg:col-span-7">
          {/* Modos de tempo */}
          <div aria-label="Modo do timer" className="mb-8 grid w-full max-w-sm grid-cols-3 gap-1 rounded-full bg-ink-100 p-1" role="group">
            {(["foco", "pausa_curta", "pausa_longa"] as const).map((type) => (
              <button
                aria-pressed={timerType === type}
                className={`h-9 rounded-full text-sm font-medium transition-colors ${
                  timerType === type ? "bg-white text-primary-800 shadow-card" : "text-ink-600 hover:text-ink-900"
                }`}
                key={type}
                onClick={() => handleTimerTypeChange(type)}
                type="button"
              >
                {modeLabels[type]}
              </button>
            ))}
          </div>

          {/* Mostrador circular */}
          <div className="relative flex h-[260px] w-[260px] select-none items-center justify-center sm:h-[280px] sm:w-[280px]">
            <svg aria-hidden className="h-full w-full -rotate-90" viewBox="0 0 280 280">
              <circle className="fill-transparent stroke-ink-100" cx="140" cy="140" r={radius} strokeWidth="10" />
              <circle
                className={`fill-transparent transition-all duration-1000 ease-linear ${timerType === "foco" ? "stroke-primary-600" : "stroke-primary-400"}`}
                cx="140"
                cy="140"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="10"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span aria-live="off" className="tabular text-6xl font-semibold tracking-tight text-ink-900" role="timer">
                {formatTime(secondsLeft)}
              </span>
              <span className="mt-1 text-sm font-medium text-ink-500">{modeLabels[timerType]}</span>
            </div>
          </div>

          {/* Controles */}
          <div className="mt-8 flex items-center gap-3">
            <Button
              aria-label="Reiniciar cronômetro"
              className="!h-12 !w-12 !rounded-full"
              onClick={resetTimer}
              size="icon"
              variant="secondary"
            >
              <RotateCcw size={20} />
            </Button>
            <Button
              aria-label={isRunning ? "Pausar cronômetro" : "Iniciar cronômetro"}
              className="!h-14 min-w-36 !rounded-full text-base"
              onClick={toggleTimer}
              size="lg"
            >
              {isRunning ? <Pause aria-hidden size={20} /> : <Play aria-hidden size={20} />}
              {isRunning ? "Pausar" : "Começar"}
            </Button>
          </div>
        </Card>

        <div className="flex w-full flex-col gap-6 lg:col-span-5">
          <Card>
            <CardHeader icon={<BookOpen size={18} />} title="Disciplina" description="A sessão será registrada nesta disciplina." />
            <Select aria-label="Disciplina da sessão" onChange={(e) => setSelectedDiscipline(e.target.value)} value={selectedDiscipline}>
              <option value="">Sem disciplina</option>
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </Select>
          </Card>

          <Card className="flex min-h-[300px] flex-col">
            <CardHeader icon={<NotebookPen size={18} />} title="Notas de estudo"/>
            <Textarea
              aria-label="Notas de estudo"
              className="min-h-[180px] flex-1 resize-none"
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={`Anotações sobre "${getSelectedDisciplineName()}"...`}
              value={notes}
            />
          </Card>
        </div>
      </div>
    </>
  );
};

export default TimerDashboard;
