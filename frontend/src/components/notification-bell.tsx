"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId } from "@/lib/studyflow-data";

type Notificacao = {
  id: string;
  mensagem: string;
  tipo_evento: string | null;
  read_at: string | null;
  created_at: string;
};

// Sino de notificações (RF010): lê `notificacoes` do usuário logado e gera os avisos de prazo ao montar.
export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string) => {
    const { data, error: loadError } = await supabase
      .from("notificacoes")
      .select("id, mensagem, tipo_evento, read_at, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (loadError) {
      setError("Não foi possível carregar as notificações.");
      return;
    }
    setError("");
    setItems((data ?? []) as Notificacao[]);
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      const id = await getCurrentSupabaseUserId().catch(() => null);
      if (!active || !id) return;
      setUserId(id);
      // Cria as notificações de prazo pendentes e só então carrega a lista.
      await supabase.rpc("gerar_notificacoes_prazos");
      if (active) await load(id);
    }

    void init();
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const unread = items.filter((item) => !item.read_at).length;

  async function markAsRead(id: string) {
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read_at: now } : item)));
    await supabase.from("notificacoes").update({ read_at: now }).eq("id", id);
  }

  async function markAllAsRead() {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => (item.read_at ? item : { ...item, read_at: now })));
    await supabase.from("notificacoes").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && userId) void load(userId);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notificações"
        className="relative cursor-pointer rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm transition hover:bg-[#eaf6f4] hover:text-[#29645e]"
        onClick={toggle}
        type="button"
      >
        <Bell size={20} />
        {unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white"
            data-testid="notification-badge"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          aria-label="Notificações"
          className="absolute right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white p-4 shadow-xl"
          role="dialog"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <p className="text-sm font-semibold text-gray-700">Notificações</p>
            {unread > 0 ? (
              <button
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-[#29645e] hover:underline"
                onClick={markAllAsRead}
                type="button"
              >
                <CheckCheck size={14} />
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex max-h-72 flex-col overflow-y-auto">
            {error ? <p className="py-3 text-center text-xs text-red-500">{error}</p> : null}
            {!error && items.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">Nenhuma notificação por enquanto</p>
            ) : null}
            {items.map((item) => (
              <div
                className={`flex items-start gap-2 border-b border-gray-50 py-2 text-xs leading-relaxed last:border-0 ${
                  item.read_at ? "text-gray-400" : "text-gray-700"
                }`}
                key={item.id}
              >
                <div className="flex-1">
                  <p className={item.read_at ? "" : "font-medium"}>{item.mensagem}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                {!item.read_at ? (
                  <button
                    aria-label="Marcar como lida"
                    className="shrink-0 cursor-pointer rounded-full p-1 text-[#29645e] hover:bg-[#eaf6f4]"
                    onClick={() => markAsRead(item.id)}
                    type="button"
                  >
                    <CheckCheck size={14} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
