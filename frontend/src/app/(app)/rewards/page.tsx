"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Image as ImageIcon, Lock, Palette, Sparkles, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { limparAgenda } from "@/lib/agenda";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageLoading } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

type UserSession = {
  avatar_url?: string | null;
  email: string;
  nome: string;
  username: string;
};

const baseRewardCollections = [
  {
    title: "Ícones de perfil",
    description: "Personalize seu avatar com símbolos conquistados durante seus estudos.",
    unlocked: 0,
    total: 0,
    icon: User,
    colors: ["#29645e", "#65bfaa"],
    items: [] as string[],
  },
  {
    title: "Bordas de perfil",
    description: "Destaque seu perfil com molduras especiais de nível e conquistas.",
    unlocked: 0,
    total: 5,
    icon: Palette,
    colors: ["#705c9d", "#b09cda"],
    items: [] as string[],
  },
  {
    title: "Banners de fundo",
    description: "Desbloqueie cenários para deixar seu perfil com a sua cara.",
    unlocked: 0,
    total: 5,
    icon: ImageIcon,
    colors: ["#c08032", "#e6bd72"],
    items: [] as string[],
  },
];

export default function RewardsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [selectedCollection, setSelectedCollection] = useState(0);
  const [rewardCollections, setRewardCollections] = useState(baseRewardCollections);

  useEffect(() => {
    async function loadRewards() {
      const parsedSession = getStoredSession();

      if (!parsedSession) {
        router.push("/");
        return;
      }

      try {
        setUser(parsedSession);
        const currentUserId = await getCurrentSupabaseUserId(parsedSession);

        if (!currentUserId) return;

        const [{ data: unlocked }, { data: total }, { data: profile }] = await Promise.all([
          supabase.from("user_conquistas").select("conquistas(nome)").eq("user_id", currentUserId),
          supabase.from("conquistas").select("nome"),
          supabase.from("profiles").select("avatar_url").eq("id", currentUserId).maybeSingle(),
        ]);

        if (profile?.avatar_url) {
          setUser((curr) => curr ? { ...curr, avatar_url: profile.avatar_url } : null);
        }

        const unlockedNames = (unlocked ?? []).map((item) => {
          const conquista = Array.isArray(item.conquistas) ? item.conquistas[0] : item.conquistas;
          return conquista?.nome ?? "Conquista";
        });

        setRewardCollections([
          {
            ...baseRewardCollections[0],
            items: unlockedNames,
            total: total?.length ?? 0,
            unlocked: unlockedNames.length,
          },
          baseRewardCollections[1],
          baseRewardCollections[2],
        ]);
      } catch {
        localStorage.removeItem("studyflow_session");
        limparAgenda();
        router.push("/");
      }
    }

    void loadRewards();
  }, [router]);


  if (!user) {
    return <PageLoading label="Carregando recompensas..." />;
  }

  const selected = rewardCollections[selectedCollection];
  const totalRewards = rewardCollections.reduce((sum, collection) => sum + collection.total, 0);
  const unlockedRewards = rewardCollections.reduce((sum, collection) => sum + collection.unlocked, 0);
  const generalProgress = totalRewards > 0 ? Math.round((unlockedRewards / totalRewards) * 100) : 0;

  return (
    <>
      <PageHeader title="Recompensas" />

      <Card className="relative overflow-hidden !border-primary-800 !bg-primary-800 text-white">
        <div aria-hidden className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/[0.06]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white/10">
              <Gift size={22} />
            </span>
            <div>
              <h2 className="text-lg font-semibold !text-white">Sua dedicação também vira coleção</h2>
              <p className="mt-1 max-w-xl text-sm text-primary-100">Cada conquista desbloqueada entra na sua coleção de ícones de perfil.</p>
            </div>
          </div>
          <div className="min-w-[220px] rounded-card bg-white/10 p-4">
            <p className="text-xs font-medium text-primary-100">Progresso geral</p>
            <p className="tabular mt-1 text-2xl font-semibold">
              {unlockedRewards} de {totalRewards}
            </p>
            <div
              aria-label="Progresso geral da coleção"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={generalProgress}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
            >
              <div className="h-full rounded-full bg-primary-300" style={{ width: `${generalProgress}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-primary-100">{generalProgress}% desbloqueado</p>
          </div>
        </div>
      </Card>

      <section aria-label="Coleções" className="mt-6 grid gap-4 md:grid-cols-3">
        {rewardCollections.map((collection, index) => {
          const Icon = collection.icon;
          const progress = collection.total > 0 ? Math.round((collection.unlocked / collection.total) * 100) : 0;
          const isSelected = selectedCollection === index;

          return (
            <button
              aria-pressed={isSelected}
              className={`rounded-card border bg-surface p-5 text-left shadow-card transition-colors hover:border-primary-300 ${
                isSelected ? "border-primary-500 ring-2 ring-primary-100" : "border-line"
              }`}
              key={collection.title}
              onClick={() => setSelectedCollection(index)}
              type="button"
            >
              <div className="flex items-start justify-between">
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-[12px] text-white"
                  style={{ background: `linear-gradient(135deg, ${collection.colors[0]}, ${collection.colors[1]})` }}
                >
                  <Icon size={20} />
                </span>
                <Badge>
                  {collection.unlocked}/{collection.total}
                </Badge>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{collection.title}</h3>
              <p className="mt-1 min-h-10 text-sm text-ink-500">{collection.description}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-ink-500">
                {progress}% concluído · {Math.max(0, collection.total - collection.unlocked)} bloqueados
              </p>
            </button>
          );
        })}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader icon={<Sparkles size={18} />} title={selected.title} />
          <ul className="grid gap-2 sm:grid-cols-2">
            {selected.items.length === 0 && selected.total === 0 ? (
              <li className="sm:col-span-2">
                <EmptyState className="!py-8" description="Continue estudando para desbloquear os primeiros itens." title="Nenhuma recompensa desbloqueada ainda" />
              </li>
            ) : null}
            {selected.items.map((item) => (
              <li className="flex items-center gap-3 rounded-control border border-line bg-white p-3" key={item}>
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-success-soft text-success">
                  <Check size={17} />
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-medium text-ink-900">{item}</strong>
                  <small className="text-xs text-success">Desbloqueado</small>
                </div>
              </li>
            ))}
            {Array.from({ length: Math.max(0, selected.total - selected.unlocked) }, (_, index) => (
              <li className="flex items-center gap-3 rounded-control border border-dashed border-ink-200 bg-ink-50/60 p-3" key={`locked-${index}`}>
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink-100 text-ink-400">
                  <Lock size={16} />
                </span>
                <div>
                  <strong className="block text-sm font-medium text-ink-600">Recompensa secreta</strong>
                  <small className="text-xs text-ink-500">Continue estudando para descobrir</small>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="aside" className="!bg-primary-50 lg:col-span-4">
          <CardHeader icon={<Sparkles size={18} />} title="Como desbloquear?" />
          <ul className="flex flex-col gap-3 text-sm text-ink-700">
            {[
              "Estude regularmente e mantenha suas sequências.",
              "Atinja as metas semanais de horas.",
              "Complete atividades e sessões Pomodoro.",
              "Conquiste novos níveis e troféus.",
            ].map((tip) => (
              <li className="flex gap-2.5" key={tip}>
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                {tip}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
