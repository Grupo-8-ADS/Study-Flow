import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAVES,
  MENSAGEM_SEM_SESSAO,
  SemSessaoError,
  alterarConsulta,
  buscarConsulta,
  estadoConsulta,
  invalidarAposSessao,
  invalidarConsultas,
  limparConsultas,
} from './consultas';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: vi.fn() } } }));

/** Promessa que o teste resolve quando quiser (para simular a resposta atrasada do banco). */
function adiada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

describe('consultas.ts - cache das telas do site', () => {
  beforeEach(() => {
    limparConsultas();
  });

  it('buscarConsulta_quandoCarregaComSucesso_deveGuardarODadoEMarcarAHora', async () => {
    // Act
    await buscarConsulta('a', async () => ({ valor: 1 }));

    // Assert
    const estado = estadoConsulta<{ valor: number }>('a');
    expect(estado.dados).toEqual({ valor: 1 });
    expect(estado.erro).toBeNull();
    expect(estado.buscando).toBe(false);
    expect(estado.atualizadoEm).toBeGreaterThan(0);
  });

  it('buscarConsulta_quandoChamadaDuasVezesAoMesmoTempo_deveIrAoBancoUmaVez', async () => {
    // Arrange
    const carregar = vi.fn(async () => 'ok');

    // Act
    await Promise.all([buscarConsulta('b', carregar), buscarConsulta('b', carregar)]);

    // Assert
    expect(carregar).toHaveBeenCalledTimes(1);
    expect(estadoConsulta('b').dados).toBe('ok');
  });

  it('buscarConsulta_quandoFalha_deveGuardarAMensagemEManterODadoAnterior', async () => {
    // Arrange
    await buscarConsulta('c', async () => 'antigo');

    // Act
    await buscarConsulta('c', async () => {
      throw new Error('Falhou a rede.');
    });

    // Assert
    expect(estadoConsulta('c').erro).toBe('Falhou a rede.');
    expect(estadoConsulta('c').dados).toBe('antigo');
  });

  it('buscarConsulta_quandoErroNaoTemMensagem_deveUsarATextoPadrao', async () => {
    // Act
    await buscarConsulta('d', () => Promise.reject('sem detalhes'));

    // Assert
    expect(estadoConsulta('d').erro).toBe('Não foi possível carregar os dados.');
  });

  it('SemSessaoError_deveTerAMensagemQueOShellReconhece', async () => {
    // Act
    await buscarConsulta('e', async () => {
      throw new SemSessaoError();
    });

    // Assert
    expect(estadoConsulta('e').erro).toBe(MENSAGEM_SEM_SESSAO);
  });

  it('alterarConsulta_quandoHaDado_deveAplicarAAlteracao', async () => {
    // Arrange
    await buscarConsulta('f', async () => ({ nome: 'Ana', nivel: 1 }));

    // Act
    alterarConsulta<{ nome: string; nivel: number }>('f', (atual) => ({ ...atual, nivel: 2 }));

    // Assert
    expect(estadoConsulta('f').dados).toEqual({ nome: 'Ana', nivel: 2 });
  });

  it('alterarConsulta_quandoAindaNaoCarregou_naoDeveInventarDado', () => {
    // Act
    alterarConsulta<number>('g', () => 42);

    // Assert
    expect(estadoConsulta('g').dados).toBeUndefined();
  });

  it('invalidarConsultas_quandoJaCarregada_deveBuscarDeNovo', async () => {
    // Arrange
    let versao = 0;
    const carregar = vi.fn(async () => ++versao);
    await buscarConsulta('h', carregar);

    // Act
    invalidarConsultas('h', 'nunca-carregada');
    await vi.waitFor(() => expect(estadoConsulta('h').dados).toBe(2));

    // Assert
    expect(carregar).toHaveBeenCalledTimes(2);
    expect(estadoConsulta('nunca-carregada').dados).toBeUndefined();
  });

  it('invalidarAposSessao_deveRecarregarPerfilConquistasEstatisticasEResumo', async () => {
    // Arrange
    const carregadores = Object.values(CHAVES).map((chave) => {
      const carregar = vi.fn(async () => chave);
      return { chave, carregar };
    });
    for (const { chave, carregar } of carregadores) await buscarConsulta(chave, carregar);

    // Act
    invalidarAposSessao();
    await vi.waitFor(() => {
      for (const { carregar } of carregadores) expect(carregar).toHaveBeenCalledTimes(2);
    });
  });

  it('limparConsultas_quandoRespostaChegaDepois_deveDescartarODadoDoUsuarioAnterior', async () => {
    // Arrange
    const resposta = adiada<string>();
    const busca = buscarConsulta('i', () => resposta.promessa);

    // Act
    limparConsultas();
    resposta.resolver('dado de outra conta');
    await busca;

    // Assert
    expect(estadoConsulta('i').dados).toBeUndefined();
  });

  it('limparConsultas_quandoFalhaChegaDepois_deveDescartarOErro', async () => {
    // Arrange
    const busca = buscarConsulta('j', () => Promise.reject(new Error('tarde demais')));

    // Act
    limparConsultas();
    await busca;

    // Assert
    expect(estadoConsulta('j').erro).toBeNull();
  });
});
