export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Coordinates stay in source-image pixels; preview size never changes the export.
export function getPhotoCrop(width, height, zoom = 1, position = { x: 0.5, y: 0.5 }) {
    if (!(width > 0 && height > 0)) throw new Error('Dimensões de imagem inválidas.');
    const size = Math.min(width, height) / clamp(zoom, 1, 3);
    return { x: (width - size) * clamp(position.x, 0, 1), y: (height - size) * clamp(position.y, 0, 1), size };
}

export function movePhotoCrop(width, height, zoom, position, dx, dy, previewSize) {
    const crop = getPhotoCrop(width, height, zoom, position);
    const scale = previewSize / crop.size;
    return {
        x: width > crop.size ? clamp(position.x - dx / (scale * (width - crop.size)), 0, 1) : 0.5,
        y: height > crop.size ? clamp(position.y - dy / (scale * (height - crop.size)), 0, 1) : 0.5,
    };
}
