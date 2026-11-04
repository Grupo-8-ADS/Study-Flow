/**
 * Página de Configurações Básicas do aplicativo Study Flow.
 * Esta tela renderiza a visualização de configurações no modo simplificado/básico,
 * limitando recursos avançados por meio da propriedade `basic`.
 * @packageDocumentation
 */

import { ConfiguracoesView } from "@/app/(app)/configuracoes/page";

/**
 * Componente padrão da página de Configurações Básicas.
 * Renderiza a view comum de configurações com a flag `basic` ativada.
 */
export default function ConfiguracoesBasicoPage() {
  return <ConfiguracoesView basic />;
}

