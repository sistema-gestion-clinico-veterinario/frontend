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
});
