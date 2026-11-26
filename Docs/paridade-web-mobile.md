# Paridade web × mobile

Regra do projeto: **regra de negócio, catálogo, texto e validação ficam em `packages/shared`**
(com teste unitário); o site (`frontend`) e o app (`mobile`) só fazem a interface. Todo PR
marca no template se web e mobile foram atualizados.

Legenda: ✔ igual nas duas plataformas · ✔\* igual, com diferença só de interface (justificada).

| Funcionalidade | Web | Mobile | Fonte única no shared | Situação |
|---|---|---|---|---|
| Login por e-mail ou usuário | ✔ | ✔ | `login.ts` (`entrar`, rota `/api/auth/entrar`) | ✔ |
| Cadastro (campos, e-mail válido, senha, normalização) | ✔ | ✔ | `validarCadastro`, `SENHA_MINIMA`, `isValidEmail` | ✔ |
| Confirmação de e-mail e recuperação de senha | ✔ | ✔ | Supabase Auth; o app manda o link para `SITE_URL/redefinir-senha` | ✔\* a página de nova senha é a do site nas duas |
| Disciplinas (CRUD, exclusão em cascata) | ✔ | ✔ | `criarAgenda` (`agenda.ts`) | ✔ |
| Horários de aula + aviso de conflito | ✔ | ✔ | `conflitosAoSalvar`, `descreverConflito`, `AVISO_CONFLITO`, `resumoHorarios` | ✔\* aviso é modal no site e `Alert` nativo no app |
| Rotina fixa (trabalho, academia…) | ✔ | ✔ | `salvarRotina`/`excluirRotina`, `itensComHorarios` | ✔ |
| Horários livres para estudar (`rotinas_semanais`) | ✔ | ✔ | `carregar/adicionar/removerHorarioLivre` | ✔ (sem armazenamento local: falha mostra erro e Tentar de novo) |
| Geração do cronograma | ✔ | ✔ | `planejarCronograma`, `COMO_O_CRONOGRAMA_E_MONTADO`, `textoDescartados`, `rotuloResumoCronograma` | ✔ |
| Limite diário de estudo | ✔ | ✔ | `limiteDiarioInicial` (meta do perfil ou 4 h), `lerLimiteDiario` | ✔ |
| Calendário, atividades e compromissos | ✔ | ✔ | `agenda.ts` | ✔ |
| Timer Pomodoro configurável | ✔ | ✔ | `normalizarPomodoro`, `proximoModo`, `avisoFimDeCiclo`, `xpDaSessao` | ✔\* a configuração fica no aparelho (preferência de uso local, como volume) |
| XP e curva de nível | ✔ | ✔ | `progressoNivel`, `xpParaNivel` (= `public.nivel_por_xp`), `XP_MAXIMO_POR_SESSAO` | ✔ |
| Regras de XP explicadas ao usuário | ✔ | ✔ | `REGRAS_XP`, `FAQ` | ✔ (o app dizia "+25 XP por sessão" e "a cada 100 XP") |
| Conquistas (progresso e nome dinâmico) | ✔ | ✔ | `progressoConquista`, `nomeConquista`, `maiorSequencia` | ✔ |
| Recompensas: catálogo de molduras e banners | ✔ | ✔ | `MOLDURAS`, `BANNERS`, `desbloqueado`, `resumoColecao`, `textoProximaRecompensa` | ✔ (o app tinha um catálogo fixo e falso) |
| Equipar/desequipar moldura e banner | ✔ | ✔ | `equiparRecompensa` (o trigger `validar_recompensas_perfil` valida o nível) | ✔ |
| Moldura no avatar (menu/cabeçalho, perfil, configurações, recompensas) | ✔ | ✔ | geometria `ArteMoldura`; `MolduraAvatar` web/RN | ✔\* a arte "Formatura" é PNG nos dois; o banner "Raposa" é WebP no site e JPEG no app |
| Banner do perfil (imagem própria ou pronto) | ✔ | ✔ | `bannerPreset`, `valorBanner` | ✔ |
| Privacidade (perfil público, horas, conquistas, compartilhar) | ✔ | ✔ | `privacidade.ts` + coluna `profiles.privacidade` | ✔ (antes: localStorage no site e nada no app; o valor antigo do site é migrado uma vez) |
| Compartilhar progresso | ✔ | ✔ | `textoCompartilhamento` com `ocultarHoras` e `link` | ✔\* site: copiar/WhatsApp/X; app: menu nativo de compartilhamento |
| Estatísticas: metas da semana e do mês | ✔ | ✔ | `metasDeEstudo` | ✔ (o app usava 20 h/semana fixo) |
| Estatísticas: semana e mês | ✔ | ✔ | `intervaloDoPeriodo` (segunda a domingo) | ✔ (o site começava no domingo) |
| Dashboard: sequência atual | ✔ | ✔ | `sequenciaAtual` (dias locais) | ✔ (o site contava em UTC) |
| Dashboard/estatísticas: distribuição por disciplina | ✔ | ✔ | `distribuicaoEstudo`, `SEM_DISCIPLINA` | ✔ (o app mostrava 4 e contava sessões sem disciplina) |
| Relatório de estudos (RF011) e CSV | ✔ | ✔ | `montarRelatorio`, `relatorioParaCSV`, `resumoRelatorio`, `nomeArquivoRelatorio` | ✔\* site baixa o arquivo; app salva e abre o menu de compartilhamento (expo-sharing) |
| Notificações (sino e lembretes) | ✔ | ✔ | tabela `notificacoes` + `gerar_notificacoes_prazos` | ✔\* o app também agenda lembretes locais do aparelho |
| Integração com o Gmail | ✔ | ✔ | rotas `/api/gmail/*` (o app chama por `chamarApi`) | ✔ |
| Perfil (nome, usuário, avatar, banner, cor) | ✔ | ✔ | Supabase `profiles` | ✔\* recorte da foto: componente próprio no site, editor nativo no app |
| FAQ e termos de serviço | ✔ | ✔ | `FAQ`, `TERMOS_SERVICO` | ✔ |
| Excluir conta (e conta de demonstração protegida) | ✔ | ✔ | `delete_own_account`, `contaDemonstracao`, `TEXTO_EXCLUIR_CONTA` | ✔ (o app não protegia a conta demo) |

## Como manter

- Mudou uma regra, texto ou validação? Mude no shared e use nas duas telas.
- Diferença só de interface (gesto nativo, componente da plataforma) entra aqui como ✔\* com o motivo.
- O PR não fica pronto com item faltando nesta tabela sem justificativa.
