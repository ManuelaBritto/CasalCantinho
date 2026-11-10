// Reduz imagens no navegador antes de guardar (economiza espaço e banda).

export async function reduzirImagem(arquivo, { ladoMaximo = 1280, qualidade = 0.82 } = {}) {
  if (!arquivo || !arquivo.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG, PNG, WEBP ou GIF).');
  if (arquivo.size > 15 * 1024 * 1024) throw new Error('A imagem é muito grande (máximo 15 MB).');
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não foi possível ler esta imagem.'));
      i.src = url;
    });
    const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
    const largura = Math.round(img.naturalWidth * escala);
    const altura = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(img, 0, 0, largura, altura);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade));
    const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
    return { blob, dataUrl, largura, altura };
  } finally {
    URL.revokeObjectURL(url);
  }
}
