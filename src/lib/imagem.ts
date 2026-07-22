/**
 * Utilitários de imagem para fichas de produto.
 * `comprimirImagem`: reduz a foto para no máximo `maxBytes` (padrão 300 KB) antes
 * de subir ao Cloudinary, economizando o espaço limitado do plano.
 */

const LIMITE_PADRAO = 300 * 1024; // 300 KB

/**
 * Reencoda a imagem como JPEG reduzindo qualidade e, se necessário, dimensão,
 * até ficar abaixo de `maxBytes`. Devolve sempre um Blob JPEG.
 */
export async function comprimirImagem(arquivo: File | Blob, maxBytes = LIMITE_PADRAO): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const LADO_MAX = 1600;
  let largura = bitmap.width;
  let altura = bitmap.height;
  if (Math.max(largura, altura) > LADO_MAX) {
    const escala = LADO_MAX / Math.max(largura, altura);
    largura = Math.round(largura * escala);
    altura = Math.round(altura * escala);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Não foi possível processar a imagem neste navegador.');
  }

  let qualidade = 0.9;
  let blob: Blob | null = null;
  // reduz a qualidade progressivamente; quando chega no piso, reduz a dimensão
  for (let tentativa = 0; tentativa < 14; tentativa++) {
    canvas.width = largura;
    canvas.height = altura;
    ctx.clearRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', qualidade));
    if (blob && blob.size <= maxBytes) break;
    if (qualidade > 0.42) {
      qualidade -= 0.12;
    } else {
      largura = Math.round(largura * 0.85);
      altura = Math.round(altura * 0.85);
      qualidade = 0.7;
      if (largura < 200) break;
    }
  }
  bitmap.close?.();
  if (!blob) throw new Error('Não foi possível comprimir a imagem.');
  return blob;
}
