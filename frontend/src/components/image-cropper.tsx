"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Props = {
  /** Imagem de origem (data URL ou URL com CORS liberado). */
  src: string;
  /** "avatar" = quadrado com máscara redonda; "banner" = 3:1. */
  formato: "avatar" | "banner";
  onCancel: () => void;
  /** Recebe a imagem recortada (JPEG, já reduzida). */
  onConfirm: (dataUrl: string) => void;
};

const SAIDA = { avatar: { w: 320, h: 320 }, banner: { w: 1200, h: 400 } } as const;
/** Largura da área de recorte na tela (px). */
const VISOR = { avatar: 280, banner: 480 } as const;

/**
 * Recorte de imagem: arrastar para posicionar, zoom e girar. A saída é um JPEG no
 * tamanho final (avatar 320×320, banner 1200×400), bem menor que a foto original.
 */
export function ImageCropper({ src, formato, onCancel, onConfirm }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [erro, setErro] = useState("");
  const [zoom, setZoom] = useState(1);
  const [giro, setGiro] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const largura = VISOR[formato];
  const altura = formato === "avatar" ? largura : Math.round(largura / 3);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.onerror = () => setErro("Não foi possível abrir esta imagem.");
    i.src = src;
  }, [src]);

  // Dimensões da imagem (já girada) para cobrir o visor no zoom 1.
  const deitada = giro % 180 !== 0;
  const iw = img ? (deitada ? img.naturalHeight : img.naturalWidth) : 1;
  const ih = img ? (deitada ? img.naturalWidth : img.naturalHeight) : 1;
  const escalaBase = Math.max(largura / iw, altura / ih);
  const escala = escalaBase * zoom;
  const limiteX = Math.max(0, (iw * escala - largura) / 2);
  const limiteY = Math.max(0, (ih * escala - altura) / 2);
  const prender = (p: { x: number; y: number }) => ({
    x: Math.min(limiteX, Math.max(-limiteX, p.x)),
    y: Math.min(limiteY, Math.max(-limiteY, p.y)),
  });
  const posicao = prender(pos);

  const iniciar = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, px: posicao.x, py: posicao.y };
  };
  const mover = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrasto.current) return;
    setPos(prender({ x: arrasto.current.px + e.clientX - arrasto.current.x, y: arrasto.current.py + e.clientY - arrasto.current.y }));
  };

  const confirmar = () => {
    if (!img) return;
    const saida = SAIDA[formato];
    const canvas = document.createElement("canvas");
    canvas.width = saida.w;
    canvas.height = saida.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fator = saida.w / largura;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, saida.w, saida.h);
    ctx.translate(saida.w / 2 + posicao.x * fator, saida.h / 2 + posicao.y * fator);
    ctx.rotate((giro * Math.PI) / 180);
    const s = escala * fator;
    ctx.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    try {
      onConfirm(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setErro("Esta imagem não pode ser editada. Escolha um arquivo do seu computador.");
    }
  };

  return (
    <Modal
      footer={
        <>
          <Button onClick={onCancel} variant="secondary">
            Cancelar
          </Button>
          <Button disabled={!img} onClick={confirmar}>
            Aplicar
          </Button>
        </>
      }
      onClose={onCancel}
      size={formato === "banner" ? "lg" : "md"}
      title={formato === "avatar" ? "Ajustar foto" : "Ajustar banner"}
    >
      {erro ? (
        <p className="text-sm text-danger">{erro}</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            aria-label="Arraste para posicionar a imagem"
            className="relative cursor-grab touch-none overflow-hidden rounded-control bg-ink-100 active:cursor-grabbing"
            onPointerCancel={() => (arrasto.current = null)}
            onPointerDown={iniciar}
            onPointerMove={mover}
            onPointerUp={() => (arrasto.current = null)}
            onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.0015)))}
            role="img"
            style={{ height: altura, maxWidth: "100%", width: largura }}
          >
            {img ? (
              <img
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                draggable={false}
                src={src}
                style={{
                  width: img.naturalWidth * escala,
                  height: img.naturalHeight * escala,
                  transform: `translate(-50%, -50%) translate(${posicao.x}px, ${posicao.y}px) rotate(${giro}deg)`,
                }}
              />
            ) : null}
            {formato === "avatar" ? (
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(15,28,29,0.45)]" />
            ) : null}
          </div>

          <div className="flex w-full max-w-sm items-center gap-3">
            <Button aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(1, z - 0.2))} size="icon-sm" variant="ghost">
              <Minus size={16} />
            </Button>
            <input
              aria-label="Zoom"
              className="flex-1 accent-primary-700"
              max={4}
              min={1}
              onChange={(e) => setZoom(Number(e.target.value))}
              step={0.01}
              type="range"
              value={zoom}
            />
            <Button aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(4, z + 0.2))} size="icon-sm" variant="ghost">
              <Plus size={16} />
            </Button>
            <Button aria-label="Girar 90 graus" onClick={() => setGiro((g) => (g + 90) % 360)} size="icon-sm" variant="secondary">
              <RotateCw size={16} />
            </Button>
          </div>
          <p className="text-xs text-ink-500">Arraste para posicionar. Use a roda do mouse ou o controle para dar zoom.</p>
        </div>
      )}
    </Modal>
  );
}
