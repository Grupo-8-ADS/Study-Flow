import { faker } from "@faker-js/faker";
import type { CreateDisciplinaInput } from "../schemas/disciplina.schema";

/**
 * Padrão Test Data Builder (Aula 02 - Slide 13)
 * Elimina o antipadrão Mystery Guest gerando dados sintéticos realistas e
 * permitindo customização explícita apenas dos campos relevantes para o teste.
 */
export class DisciplinaBuilder {
  private data: CreateDisciplinaInput;

  constructor() {
    // Valores padrão gerados dinamicamente via Faker
    this.data = {
      nome: `${faker.word.adjective()} ${faker.science.chemicalElement().name}`,
      professor: `Prof. ${faker.person.fullName()}`,
      data_inicio: "01/02/2026",
      data_fim: "30/06/2026",
      anotacoes: {
        sala: `Bloco ${faker.string.alphanumeric(1).toUpperCase()}-${faker.number.int({ min: 101, max: 305 })}`,
        ementa: faker.lorem.sentence(),
      },
    };
  }

  static aDisciplina(): DisciplinaBuilder {
    return new DisciplinaBuilder();
  }

  withNome(nome: string): this {
    this.data.nome = nome;
    return this;
  }

  withProfessor(professor: string | null): this {
    this.data.professor = professor;
    return this;
  }

  withDatas(dataInicio: string | null, dataFim: string | null): this {
    this.data.data_inicio = dataInicio;
    this.data.data_fim = dataFim;
    return this;
  }

  withAnotacoes(anotacoes: Record<string, any>): this {
    this.data.anotacoes = anotacoes;
    return this;
  }

  build(): CreateDisciplinaInput {
    return { ...this.data };
  }

  /**
   * Constrói um payload cru com campos estranhos para testar rejeição por .strict() (422)
   */
  buildWithUnknownField(extraField: Record<string, any>): Record<string, any> {
    return {
      ...this.data,
      ...extraField,
    };
  }
}
