import type { ReactNode } from "react";
import { bannerPreset, gradienteCss, molduraPorId, type BannerPreset } from "@studyflow/shared";

/** Caminho público das artes de recompensa (frontend/public/recompensas). */
export const urlRecompensa = (arquivo: string) => `/recompensas/${arquivo}`;

/**
 * Moldura em volta do avatar quando o usuário equipou uma: aro em gradiente ou, nas molduras
 * desenhadas, a arte por cima do avatar (com os enfeites, como o capelo, saindo para fora).
 */
export function MolduraAvatar({ moldura, espessura = 3, className = "", children }: { moldura?: string | null; espessura?: number; className?: string; children: ReactNode }) {
  const m = molduraPorId(moldura);
  if (!m) return <>{children}</>;
  if (m.arte) {
    const { arquivo, escala, x, y } = m.arte;
    return (
      <span className={`relative inline-flex shrink-0 rounded-full ${className}`}>
        {children}
        <img
          alt=""
          aria-hidden
          className="pointer-events-none absolute max-w-none select-none"
          draggable={false}
          src={urlRecompensa(arquivo)}
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${escala * 100}%` }}
        />
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 rounded-full ${className}`} style={{ background: gradienteCss(m.cores), padding: espessura }}>
      {children}
    </span>
  );
}

/** Prévia de um banner pronto (ilustração ou gradiente). */
export function PreviaBanner({ banner, miniatura = false }: { banner: BannerPreset; miniatura?: boolean }) {
  if (banner.imagem) {
    const arquivo = miniatura ? banner.imagem.replace(/\.webp$/, "-mini.webp") : banner.imagem;
    return (
      <img
        alt={`Banner ${banner.nome}`}
        className="absolute inset-0 h-full w-full object-cover"
        // A ilustração tem o personagem à direita: mantém ele visível em telas estreitas.
        style={{ background: gradienteCss(banner.cores), objectPosition: "75% center" }}
        src={urlRecompensa(arquivo)}
      />
    );
  }
  return <div aria-label={`Banner ${banner.nome}`} className="absolute inset-0" role="img" style={{ background: gradienteCss(banner.cores) }} />;
}

/** Fundo do banner: imagem enviada, banner pronto ("preset:<id>") ou o gradiente padrão. */
export function FundoBanner({ valor, corPadrao = "#0F1C1D", alt = "Banner do perfil" }: { valor?: string | null; corPadrao?: string; alt?: string }) {
  const preset = bannerPreset(valor);
  if (preset) return <PreviaBanner banner={preset} />;
  if (valor) return <img alt={alt} className="absolute inset-0 h-full w-full object-cover" src={valor} />;
  return <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${corPadrao} 0%, #29645e 100%)` }} />;
}
