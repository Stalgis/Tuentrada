/**
 * Generación de sesión.
 *
 * Contador que se incrementa en cada inicio y cierre de sesión. Toda petición
 * captura la generación vigente antes de salir y la verifica antes de escribir
 * en cachés o en estado; si cambió, el resultado se descarta.
 *
 * Esto evita que una respuesta en vuelo de la sesión anterior repueble datos ya
 * limpiados: limpiar un Map de promesas no cancela las peticiones subyacentes,
 * así que la protección real está en la guarda de escritura, no en el borrado.
 */

let generation = 0;

export const currentGeneration = (): number => generation;

/** Invalida la generación vigente. Devuelve la nueva. */
export const bumpGeneration = (): number => ++generation;

export const isCurrentGeneration = (gen: number): boolean => gen === generation;
