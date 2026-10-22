/** Reduz uma imagem para uma miniatura JPEG em data URL (capas e figurinhas ficam leves no IndexedDB). */
export async function toThumbnail(source: Blob | HTMLCanvasElement, maxWidth = 360, type = 'image/jpeg'): Promise<string> {
  const image = source instanceof Blob ? await createImageBitmap(source) : source;
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ('close' in image) image.close();
  return canvas.toDataURL(type, 0.85);
}
