/**
 * Layout raiz do aplicativo Study Flow.
 * Carrega as fontes pelo `next/font` (servidas pelo próprio site, sem depender do Google em tempo de execução)
 * e aplica os estilos globais do sistema de design.
 * @packageDocumentation
 */

import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Rubik_Bubbles } from "next/font/google";
import "./globals.css";

/** Fonte de interface: Inter variável (todos os pesos reais, sem negrito sintético). */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Fonte da marca, usada só no logotipo "Study Flow". */
const rubikBubbles = Rubik_Bubbles({
  variable: "--font-rubik-bubbles",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/** Fonte monoespaçada (trechos técnicos, como códigos de cor). */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Metadados globais da aplicação.
 */
export const metadata: Metadata = {
  title: {
    default: "Study Flow",
    template: "%s · Study Flow",
  },
  description: "Organize disciplinas, prazos e sessões de estudo com Pomodoro, cronograma automático e conquistas.",
};

export const viewport: Viewport = {
  themeColor: "#29645e",
};

/**
 * Componente de Layout Raiz (Root Layout).
 *
 * @param props - Propriedades do componente.
 * @param props.children - Páginas renderizadas dentro do body.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${rubikBubbles.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
