import type { ReactNode } from "react";
import { bannerPreset, gradienteCss, molduraPorId } from "@studyflow/shared";

/** Aro em gradiente em volta do avatar quando o usuário equipou uma moldura. */
export function MolduraAvatar({ moldura, espessura = 3, className = "", children }: { moldura?: string | null; espessura?: number; className?: string; children: ReactNode }) {
  const m = molduraPorId(moldura);
  if (!m) return <>{children}</>;
  return (
    <span className={`inline-flex shrink-0 rounded-full ${className}`} style={{ background: gradienteCss(m.cores), padding: espessura }}>
      {children}
    </span>
  );
}

/** Fundo do banner: imagem enviada, banner pronto ("preset:<id>") ou o gradiente padrão. */
export function FundoBanner({ valor, corPadrao = "#0F1C1D", alt = "Banner do perfil" }: { valor?: string | null; corPadrao?: string; alt?: string }) {
  const preset = bannerPreset(valor);
  if (preset) return <div aria-label={`Banner ${preset.nome}`} className="absolute inset-0" role="img" style={{ background: gradienteCss(preset.cores) }} />;
  if (valor) return <img alt={alt} className="absolute inset-0 h-full w-full object-cover" src={valor} />;
  return <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${corPadrao} 0%, #29645e 100%)` }} />;
}
