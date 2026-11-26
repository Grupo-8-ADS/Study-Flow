/**
 * Avatares gerados pelo DiceBear (estilos com licença CC0: uso livre, sem atribuição
 * obrigatória). O site e o app mostram a mesma galeria e gravam a mesma URL em
 * profiles.avatar_url.
 */

export const ESTILOS_AVATAR = [
  { id: 'notionists', nome: 'Rabisco' },
  { id: 'lorelei', nome: 'Ilustrado' },
  { id: 'thumbs', nome: 'Polegar' },
] as const;

export type EstiloAvatar = (typeof ESTILOS_AVATAR)[number]['id'];

/** Quantos avatares a galeria mostra de cada vez. */
export const AVATARES_POR_GALERIA = 8;

/** PNG 256×256 redondo, com fundo nas cores do app. */
export const urlAvatar = (estilo: EstiloAvatar, semente: string) =>
  `https://api.dicebear.com/9.x/${estilo}/png?size=256&seed=${encodeURIComponent(semente)}&backgroundColor=d1ece8,e3f3f0,fff4d6,fdecea&radius=50`;

/** Sementes aleatórias: nada do usuário (nome, e-mail) é enviado ao serviço de avatares. */
export const novasSementes = (quantidade = AVATARES_POR_GALERIA) =>
  Array.from({ length: quantidade }, () => Math.random().toString(36).slice(2, 10));
