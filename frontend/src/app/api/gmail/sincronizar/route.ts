import { NextResponse } from "next/server";
import { extrairEventoDoEmail, montarConsultaGmail, type PalavraChave } from "@studyflow/shared";
import {
  GmailErro,
  buscarEmails,
  clienteServico,
  lerConfigGmail,
  renovarAcesso,
  usuarioDaRequisicao,
} from "@/lib/gmail-server";

/** Na primeira sincronização, olha os e-mails dos últimos 30 dias. */
const JANELA_INICIAL_DIAS = 30;

/**
 * RF012: busca no Gmail os e-mails que batem com as palavras-chave do usuário e cria
 * itens no cronograma (prova, trabalho, entrega ou atividade) sem duplicar.
 */
export async function POST(request: Request) {
  const config = lerConfigGmail();
  if (!config) {
    return NextResponse.json({ code: "GMAIL_NAO_CONFIGURADO", message: "Integração com o Gmail não configurada no servidor" }, { status: 503 });
  }

  const userId = await usuarioDaRequisicao(request);
  if (!userId) {
    return NextResponse.json({ code: "AUTH_INVALID", message: "Token de autenticação ausente ou inválido" }, { status: 401 });
  }

  const db = clienteServico(config);
  const [{ data: token }, { data: status }, { data: palavras }] = await Promise.all([
    db.from("sinc_gmail_tokens").select("refresh_token").eq("user_id", userId).maybeSingle(),
    db.from("sinc_gmail").select("email_sinc, data_ultima_sinc").eq("user_id", userId).maybeSingle(),
    db.from("palavras_chave").select("palavra, localizacao").eq("user_id", userId),
  ]);

  if (!token?.refresh_token) {
    return NextResponse.json({ code: "GMAIL_DESCONECTADO", message: "Conecte sua conta do Gmail antes de sincronizar" }, { status: 409 });
  }

  const desde = status?.data_ultima_sinc
    ? new Date(status.data_ultima_sinc)
    : new Date(Date.now() - JANELA_INICIAL_DIAS * 24 * 60 * 60 * 1000);
  const consulta = montarConsultaGmail((palavras ?? []) as PalavraChave[], desde);
  if (!consulta) {
    return NextResponse.json({ code: "SEM_PALAVRAS_CHAVE", message: "Cadastre ao menos uma palavra-chave" }, { status: 422 });
  }

  const iniciadoEm = new Date().toISOString();
  try {
    const accessToken = await renovarAcesso(config, token.refresh_token);
    const emails = await buscarEmails(config, accessToken, consulta);
    const eventos = emails.map(extrairEventoDoEmail).filter((e) => e !== null);
    const comData = eventos.filter((e) => e.data);

    const { data: existentes } = comData.length
      ? await db
          .from("itens_cronograma")
          .select("origem_externa_id")
          .eq("user_id", userId)
          .in("origem_externa_id", comData.map((e) => e.origemExternaId))
      : { data: [] as Array<{ origem_externa_id: string }> };
    const jaImportados = new Set((existentes ?? []).map((i) => i.origem_externa_id));
    const novos = comData.filter((e) => !jaImportados.has(e.origemExternaId));

    if (novos.length) {
      const { error } = await db.from("itens_cronograma").insert(
        novos.map((e) => ({
          user_id: userId,
          nome: e.nome,
          tipo: e.tipo,
          data_inicio: `${e.data}T09:00:00`,
          data_fim: `${e.data}T10:00:00`,
          descricao: `Importado do Gmail${status?.email_sinc ? ` (${status.email_sinc})` : ""}`,
          origem_externa_id: e.origemExternaId,
        })),
      );
      if (error) throw error;
    }

    await db.from("sinc_gmail").update({ data_ultima_sinc: iniciadoEm }).eq("user_id", userId);

    return NextResponse.json({
      encontrados: emails.length,
      criados: novos.length,
      jaImportados: comData.length - novos.length,
      semData: eventos.length - comData.length,
    });
  } catch (err: unknown) {
    if (err instanceof GmailErro && err.codigo === "TOKEN_INVALIDO") {
      return NextResponse.json({ code: "GMAIL_REVOGADO", message: "O acesso ao Gmail expirou. Conecte a conta novamente." }, { status: 409 });
    }
    console.error("[gmail/sincronizar]", err instanceof Error ? err.message : err);
    return NextResponse.json({ code: "GMAIL_FALHOU", message: "Não foi possível sincronizar com o Gmail agora" }, { status: 502 });
  }
}
