import { comprimirImagem } from '@/lib/imagem';

/**
 * Banco de imagens (Cloudinary) para as fichas de produto do OPP.
 * Uploads são feitos direto do navegador via preset NÃO-ASSINADO — o API Secret
 * nunca entra no frontend. Cloud name e preset são informações públicas.
 */
const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || 'r1dihzpf';
const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string) || 'opp-fichas';

/** Aplica otimização automática de formato e qualidade na entrega */
export function otimizarUrl(url: string): string {
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

/** Versão miniatura (largura 120px) para previews em listas */
export function miniaturaUrl(url: string): string {
  return url.replace(/\/image\/upload\/(f_auto,q_auto\/)?/, '/image/upload/f_auto,q_auto,w_120/');
}

/** Envia uma imagem ao Cloudinary e retorna a URL segura */
export async function uploadImagem(arquivo: Blob | File): Promise<string> {
  const form = new FormData();
  form.append('file', arquivo);
  form.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const detalhe = await res.text();
    throw new Error(`Falha no upload da imagem (HTTP ${res.status}): ${detalhe.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.secure_url as string;
}

/** Comprime (≤ 300 KB) e envia a ficha ao Cloudinary; retorna a URL */
export async function uploadFicha(arquivo: Blob | File): Promise<string> {
  const otimizada =
    arquivo.type === 'image/jpeg' && arquivo.size <= 300 * 1024
      ? arquivo
      : await comprimirImagem(arquivo, 300 * 1024);
  return uploadImagem(otimizada);
}
