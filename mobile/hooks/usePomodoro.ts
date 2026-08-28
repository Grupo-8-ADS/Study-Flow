import { useState, useEffect, useRef } from 'react';
import { POMODORO_TIMES, TimerMode } from '@studyflow/shared';

interface UsePomodoroOptions {
  onComplete?: (mode: TimerMode) => void;
}

export function usePomodoro(options?: UsePomodoroOptions) {
  const [mode, setMode] = useState<TimerMode>('foco');
  const [timeLeft, setTimeLeft] = useState<number>(POMODORO_TIMES.foco);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const totalDuration = POMODORO_TIMES[mode];
  const progress = (totalDuration - timeLeft) / totalDuration;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTimeLeft(POMODORO_TIMES[mode]);
    setIsActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [mode]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            if (options?.onComplete) {
              options.onComplete(mode);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, mode]);

  const toggleStartPause = () => {
    setIsActive((prev) => !prev);
  };

  const reset = () => {
    setIsActive(false);
    setTimeLeft(POMODORO_TIMES[mode]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    mode,
    setMode,
    timeLeft,
    isActive,
    progress,
    toggleStartPause,
    reset,
    formattedTime: formatTime(timeLeft),
    selectedSubject,
    setSelectedSubject,
    notes,
    setNotes,
  };
}
