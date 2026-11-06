"use client";

import type { NextPage } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { BookOpen, NotebookPen, Pause, Play, RotateCcw, Settings2, SkipForward } from "lucide-react";
import {
  LIMITES_POMODORO,
  POMODORO_PADRAO,
  PRESETS_POMODORO,
  ROTULO_MODO,
  duracaoModo,
  normalizarPomodoro,
  proximoModo,
  segundosRestantes,
  type ConfigPomodoro,
  type ModoPomodoro,
} from "@studyflow/shared";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { useAgenda } from "@/lib/agenda";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageLoading } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

interface UserSession {
  email: string;
  nome: string;
  username: string;
  avatar_url?: string | null;
}

type DisciplineOption = { id: string; name: string };

const chaveConfig = (email: string) => `studyflow_pomodoro_${email}`;

/** Bipe curto ao terminar um ciclo (sem arquivo de áudio). */
function tocarAviso() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((atraso) => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = 880;
      ganho.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + atraso + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + 0.18);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + 0.2);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Sem áudio disponível: segue sem som.
  }
}

const TimerDashboard: NextPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [config, setConfig] = useState<ConfigPomodoro>(POMODORO_PADRAO);
  const [editandoConfig, setEditandoConfig] = useState(false);

  // Estado do timer. O tempo restante vem do relógio (fimEm), não da contagem de ticks:
  // em aba de fundo o navegador atrasa o setInterval e o timer "andava devagar".
  const [timerType, setTimerType] = useState<ModoPomodoro>("foco");
  const [totalDuration, setTotalDuration] = useState<number>(duracaoModo("foco", POMODORO_PADRAO));
  const [secondsLeft, setSecondsLeft] = useState<number>(totalDuration);
  const [fimEm, setFimEm] = useState<number | null>(null);
  const isRunning = fimEm !== null;
  const [focosConcluidos, setFocosConcluidos] = useState(0);
  const [aviso, setAviso] = useState("");

  // Disciplinas & Notas
  const { dados: agenda } = useAgenda();
  const disciplines: DisciplineOption[] = (agenda?.disciplinas ?? []).map((d) => ({ id: d.id, name: d.nome }));
  // null = ainda não escolheu: usa a primeira disciplina cadastrada.
  const [escolha, setSelectedDiscipline] = useState<string | null>(null);
  const selectedDiscipline = escolha ?? disciplines[0]?.id ?? "";
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    async function loadTimer() {
      const parsed = getStoredSession();
      if (!parsed) {
        router.push("/");
        return;
      }
      setUser(parsed);
      const cfg = normalizarPomodoro(localStorage.getItem(chaveConfig(parsed.email)));
      setConfig(cfg);
      setTotalDuration(duracaoModo("foco", cfg));
      setSecondsLeft(duracaoModo("foco", cfg));
      setSupabaseUserId(await getCurrentSupabaseUserId(parsed));
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

  const handleNotesChange = (text: string) => {
    setNotes(text);
    if (user && selectedDiscipline) {
      localStorage.setItem(`studyflow_notes_${user.email}_${selectedDiscipline}`, text);
    }
  };

  const getSelectedDisciplineName = useCallback(() => {
    return disciplines.find((discipline) => discipline.id === selectedDiscipline)?.name ?? "Sem disciplina";
  }, [disciplines, selectedDiscipline]);

  const recordStudySession = useCallback(
    async (duracaoSeg: number) => {
      if (!user) return;
      const durationMinutes = Math.round(duracaoSeg / 60);
      const finishedAt = new Date();
      const startedAt = new Date(finishedAt.getTime() - duracaoSeg * 1000);

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
    },
    [getSelectedDisciplineName, notes, selectedDiscipline, supabaseUserId, user],
  );

  /** Prepara um modo (parado ou já rodando). */
  const irParaModo = useCallback(
    (modo: ModoPomodoro, iniciar: boolean, cfg: ConfigPomodoro = config) => {
      const duracao = duracaoModo(modo, cfg);
      setTimerType(modo);
      setTotalDuration(duracao);
      setSecondsLeft(duracao);
      setFimEm(iniciar ? Date.now() + duracao * 1000 : null);
    },
    [config],
  );

  // Término do ciclo: registra a sessão (só foco), avisa e avança para o próximo modo.
  const finishCycle = useCallback(() => {
    const focos = timerType === "foco" ? focosConcluidos + 1 : focosConcluidos;
    if (timerType === "foco") {
      void recordStudySession(totalDuration);
      setFocosConcluidos(focos);
    }
    if (config.som) tocarAviso();
    const proximo = proximoModo(timerType, focos, config);
    setAviso(
      timerType === "foco"
        ? `Sessão de foco em "${getSelectedDisciplineName()}" registrada. Hora da ${ROTULO_MODO[proximo].toLowerCase()}.`
        : "A pausa acabou. Pronto para voltar ao foco?",
    );
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      new Notification("Study Flow", { body: timerType === "foco" ? "Foco concluído! Hora da pausa." : "Pausa concluída! De volta ao foco." });
    }
    irParaModo(proximo, config.autoIniciar);
  }, [config, focosConcluidos, getSelectedDisciplineName, irParaModo, recordStudySession, timerType, totalDuration]);

  const finishCycleRef = useRef(finishCycle);
  useEffect(() => {
    finishCycleRef.current = finishCycle;
  }, [finishCycle]);

  // Tique: recalcula pelo relógio. Ao voltar para a aba, corrige na hora.
  useEffect(() => {
    if (fimEm === null) return;
    let encerrado = false;
    const tique = () => {
      if (encerrado) return;
      const restante = segundosRestantes(fimEm, Date.now());
      setSecondsLeft(restante);
      if (restante === 0) {
        encerrado = true;
        finishCycleRef.current();
      }
    };
    const id = setInterval(tique, 250);
    document.addEventListener("visibilitychange", tique);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tique);
    };
  }, [fimEm]);

  // Mostra o tempo na aba do navegador enquanto roda.
  useEffect(() => {
    if (!isRunning) return;
    const original = document.title;
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    document.title = `${mm}:${ss} · ${ROTULO_MODO[timerType]}`;
    return () => {
      document.title = original;
    };
  }, [isRunning, secondsLeft, timerType]);

  const toggleTimer = () => {
    setAviso("");
    if (fimEm !== null) {
      setSecondsLeft(segundosRestantes(fimEm, Date.now()));
      setFimEm(null);
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    setFimEm(Date.now() + secondsLeft * 1000);
  };

  const resetTimer = () => {
    setAviso("");
    irParaModo(timerType, false);
  };

  const pular = () => {
    setAviso("");
    // Pular não registra a sessão de foco, mas conta para o ciclo (senão a pausa longa se repete).
    const focos = timerType === "foco" ? focosConcluidos + 1 : focosConcluidos;
    if (timerType === "foco") setFocosConcluidos(focos);
    irParaModo(proximoModo(timerType, focos, config), false);
  };

  const salvarConfig = (cfg: ConfigPomodoro) => {
    const limpa = normalizarPomodoro(cfg);
    setConfig(limpa);
    if (user) localStorage.setItem(chaveConfig(user.email), JSON.stringify(limpa));
    if (!isRunning) irParaModo(timerType, false, limpa);
    setEditandoConfig(false);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalDuration > 0 ? circumference - (secondsLeft / totalDuration) * circumference : 0;

  if (!user) {
    return <PageLoading label="Carregando timer..." />;
  }

  const cicloAtual = (focosConcluidos % config.ciclosAteLonga) + (timerType === "foco" ? 1 : 0);

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setEditandoConfig(true)} variant="secondary">
            <Settings2 aria-hidden size={18} />
            Ajustar tempos
          </Button>
        }
        title="Timer"
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <Card className="flex flex-col items-center !py-8 lg:col-span-7">
          <div aria-label="Modo do timer" className="mb-8 grid w-full max-w-sm grid-cols-3 gap-1 rounded-full bg-ink-100 p-1" role="group">
            {(["foco", "pausa_curta", "pausa_longa"] as const).map((type) => (
              <button
                aria-pressed={timerType === type}
                className={`h-9 rounded-full text-sm font-medium transition-colors ${
                  timerType === type ? "bg-white text-primary-800 shadow-card" : "text-ink-600 hover:text-ink-900"
                }`}
                key={type}
                onClick={() => {
                  setAviso("");
                  irParaModo(type, false);
                }}
                type="button"
              >
                {ROTULO_MODO[type]}
              </button>
            ))}
          </div>

          <div className="relative flex h-[260px] w-[260px] select-none items-center justify-center sm:h-[280px] sm:w-[280px]">
            <svg aria-hidden className="h-full w-full -rotate-90" viewBox="0 0 280 280">
              <circle className="fill-transparent stroke-ink-100" cx="140" cy="140" r={radius} strokeWidth="10" />
              <circle
                className={`fill-transparent transition-all duration-300 ease-linear ${timerType === "foco" ? "stroke-primary-600" : "stroke-primary-400"}`}
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
              <span className="mt-1 text-sm font-medium text-ink-500">{ROTULO_MODO[timerType]}</span>
              <span aria-label={`Ciclo ${cicloAtual} de ${config.ciclosAteLonga}`} className="mt-3 flex gap-1.5">
                {Array.from({ length: config.ciclosAteLonga }, (_, i) => (
                  <span
                    className={`h-2 w-2 rounded-full ${i < focosConcluidos % config.ciclosAteLonga ? "bg-primary-600" : "bg-ink-200"}`}
                    key={i}
                  />
                ))}
              </span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button aria-label="Reiniciar cronômetro" className="!h-12 !w-12 !rounded-full" onClick={resetTimer} size="icon" variant="secondary">
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
            <Button aria-label="Pular para o próximo modo" className="!h-12 !w-12 !rounded-full" onClick={pular} size="icon" variant="secondary">
              <SkipForward size={20} />
            </Button>
          </div>

          <p aria-live="polite" className="mt-5 min-h-5 text-center text-sm text-ink-600" role="status">
            {aviso}
          </p>
          <p className="tabular text-xs text-ink-400">
            Foco {config.foco} min · pausa {config.pausaCurta} min · pausa longa {config.pausaLonga} min a cada {config.ciclosAteLonga}
          </p>
        </Card>

        <div className="flex w-full flex-col gap-6 lg:col-span-5">
          <Card>
            <CardHeader icon={<BookOpen size={18} />} title="Disciplina" />
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
            <CardHeader icon={<NotebookPen size={18} />} title="Notas de estudo" />
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

      {editandoConfig ? <ConfigModal inicial={config} onClose={() => setEditandoConfig(false)} onSalvar={salvarConfig} /> : null}
    </>
  );
};

function ConfigModal({ inicial, onClose, onSalvar }: { inicial: ConfigPomodoro; onClose: () => void; onSalvar: (c: ConfigPomodoro) => void }) {
  const [cfg, setCfg] = useState(inicial);
  const numero = (campo: keyof typeof LIMITES_POMODORO, rotulo: string, sufixo: string) => (
    <Field htmlFor={`pomo-${campo}`} label={rotulo}>
      <div className="flex items-center gap-2">
        <Input
          id={`pomo-${campo}`}
          max={LIMITES_POMODORO[campo][1]}
          min={LIMITES_POMODORO[campo][0]}
          onChange={(e) => setCfg((c) => ({ ...c, [campo]: Number(e.target.value) }))}
          type="number"
          value={Number.isFinite(cfg[campo]) ? cfg[campo] : ""}
        />
        <span className="text-sm text-ink-500">{sufixo}</span>
      </div>
    </Field>
  );

  return (
    <Modal
      footer={
        <>
          <Button onClick={() => setCfg(POMODORO_PADRAO)} variant="ghost">
            Restaurar padrão
          </Button>
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button onClick={() => onSalvar(cfg)}>Salvar</Button>
        </>
      }
      onClose={onClose}
      title="Ajustar tempos"
    >
      <div className="flex flex-wrap gap-2">
        {PRESETS_POMODORO.map((p) => {
          const ativo = p.config.foco === cfg.foco && p.config.pausaCurta === cfg.pausaCurta && p.config.pausaLonga === cfg.pausaLonga;
          return (
            <button
              aria-pressed={ativo}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                ativo ? "border-primary-700 bg-primary-700 text-white" : "border-line bg-white text-ink-700 hover:border-ink-300"
              }`}
              key={p.nome}
              onClick={() => setCfg((c) => ({ ...c, ...p.config }))}
              type="button"
            >
              {p.nome}
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {numero("foco", "Foco", "min")}
        {numero("pausaCurta", "Pausa curta", "min")}
        {numero("pausaLonga", "Pausa longa", "min")}
        {numero("ciclosAteLonga", "Pausa longa a cada", "focos")}
      </div>
      <div className="mt-5 flex flex-col gap-3 text-sm text-ink-700">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            checked={cfg.autoIniciar}
            className="h-4 w-4 accent-primary-700"
            onChange={(e) => setCfg((c) => ({ ...c, autoIniciar: e.target.checked }))}
            type="checkbox"
          />
          Começar o próximo modo automaticamente
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input checked={cfg.som} className="h-4 w-4 accent-primary-700" onChange={(e) => setCfg((c) => ({ ...c, som: e.target.checked }))} type="checkbox" />
          Tocar um aviso sonoro ao terminar
        </label>
      </div>
    </Modal>
  );
}

export default TimerDashboard;
