import { z } from "zod";
import { isValidDateString, toDatabaseDate } from "../validation";

/**
 * Schema de validação de entrada estrita para criação de disciplinas.
 * Aplica .strict() para bloquear mass-assignment e campos estranhos (Erro 422).
 */
export const CreateDisciplinaInputSchema = z
  .object({
    nome: z
      .string({ required_error: "Nome da disciplina é obrigatório" })
      .trim()
      .min(2, "Nome deve ter no mínimo 2 caracteres")
      .max(100, "Nome deve ter no máximo 100 caracteres"),
    professor: z
      .string()
      .trim()
      .max(100, "Nome do professor não pode exceder 100 caracteres")
      .optional()
      .nullable(),
    data_inicio: z
      .string()
      .refine(isValidDateString, {
        message: "Data de início deve ser uma data válida no formato DD/MM/AAAA ou AAAA-MM-DD",
      })
      .transform((val) => toDatabaseDate(val))
      .optional()
      .nullable(),
    data_fim: z
      .string()
      .refine(isValidDateString, {
        message: "Data de término deve ser uma data válida no formato DD/MM/AAAA ou AAAA-MM-DD",
      })
      .transform((val) => toDatabaseDate(val))
      .optional()
      .nullable(),
    anotacoes: z
      .record(z.any())
      .optional()
      .default({}),
  })
  .strict();

export type CreateDisciplinaInput = z.infer<typeof CreateDisciplinaInputSchema>;

/**
 * Schema de blindagem de saída para disciplinas.
 * Filtra chaves internas e assegura serialização estrita conforme contrato da API.
 */
export const DisciplinaOutputSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    nome: z.string(),
    professor: z.string().nullable().optional(),
    data_inicio: z.string().nullable().optional(),
    data_fim: z.string().nullable().optional(),
    anotacoes: z.record(z.any()).default({}),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type DisciplinaOutput = z.infer<typeof DisciplinaOutputSchema>;
