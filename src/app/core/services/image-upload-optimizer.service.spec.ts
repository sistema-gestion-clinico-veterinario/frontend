import { calculateTargetDimensions, ImageUploadOptimizerService } from './image-upload-optimizer.service';

describe('ImageUploadOptimizerService', () => {
  const service = new ImageUploadOptimizerService();

  it('preserves dimensions when the image already fits', () => {
    expect(calculateTargetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('reduces a landscape image while preserving its aspect ratio', () => {
    expect(calculateTargetDimensions(3200, 1800)).toEqual({ width: 1600, height: 900 });
  });

  it('reduces a portrait image while preserving its aspect ratio', () => {
    expect(calculateTargetDimensions(1200, 2400)).toEqual({ width: 800, height: 1600 });
  });

  it('does not process unsupported files', async () => {
    const file = new File(['document'], 'document.pdf', { type: 'application/pdf' });
    expect(await service.optimize(file)).toBe(file);
  });

  it('does not process small images', async () => {
    const file = new File(['small'], 'photo.jpg', { type: 'image/jpeg' });
    expect(await service.optimize(file)).toBe(file);
  });

  it('uses a 640px boundary for logo dimensions', () => {
    expect(calculateTargetDimensions(1280, 720, 640)).toEqual({ width: 640, height: 360 });
  });

  it('converts a small logo to WebP and preserves its aspect ratio', async () => {
    const source = new File([new Uint8Array(100)], 'clinic-logo.png', {
      type: 'image/png',
      lastModified: 123
    });
    const bitmap = {
      width: 1280,
      height: 720,
      close: jasmine.createSpy('close')
    } as unknown as ImageBitmap;
    const drawImage = jasmine.createSpy('drawImage');
    const context = { drawImage } as unknown as CanvasRenderingContext2D;
    const canvas = document.createElement('canvas');

    spyOn(globalThis, 'createImageBitmap').and.resolveTo(bitmap);
    spyOn(document, 'createElement').and.returnValue(canvas);
    spyOn(canvas, 'getContext').and.returnValue(context);
    spyOn(canvas, 'toBlob').and.callFake((callback, type, quality) => {
      expect(type).toBe('image/webp');
      expect(quality).toBe(0.80);
      callback(new Blob([new Uint8Array(40)], { type: 'image/webp' }));
    });

    const optimized = await service.optimizeLogo(source);

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 360);
    expect(optimized.name).toBe('clinic-logo.webp');
    expect(optimized.type).toBe('image/webp');
    expect(optimized.size).toBe(40);
    expect(optimized.lastModified).toBe(123);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('keeps the original logo when WebP would be larger', async () => {
    const source = new File([new Uint8Array(20)], 'clinic-logo.png', { type: 'image/png' });
    const bitmap = {
      width: 320,
      height: 180,
      close: jasmine.createSpy('close')
    } as unknown as ImageBitmap;
    const context = { drawImage: jasmine.createSpy('drawImage') } as unknown as CanvasRenderingContext2D;
    const canvas = document.createElement('canvas');

    spyOn(globalThis, 'createImageBitmap').and.resolveTo(bitmap);
    spyOn(document, 'createElement').and.returnValue(canvas);
    spyOn(canvas, 'getContext').and.returnValue(context);
    spyOn(canvas, 'toBlob').and.callFake(callback => {
      callback(new Blob([new Uint8Array(30)], { type: 'image/webp' }));
    });

    expect(await service.optimizeLogo(source)).toBe(source);
    expect(bitmap.close).toHaveBeenCalled();
  });
});
