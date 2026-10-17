import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MediaService } from './media.service';
import { ImageUploadOptimizerService } from './image-upload-optimizer.service';

describe('MediaService', () => {
  let service: MediaService;
  let httpTesting: HttpTestingController;
  let imageOptimizer: ImageUploadOptimizerService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(MediaService);
    httpTesting = TestBed.inject(HttpTestingController);
    imageOptimizer = TestBed.inject(ImageUploadOptimizerService);
  });

  afterEach(() => httpTesting.verify());

  it('returns null for a null path', () => {
    expect(service.resolveUrl(null)).toBeNull();
  });

  it('returns the original URL unchanged when it starts with http', () => {
    const url = 'https://cdn.example.com/photo.jpg';
    expect(service.resolveUrl(url)).toBe(url);
  });

  it('prepends mediaBaseUrl for a relative path', () => {
    const path = 'uploads/foto.jpg';
    expect(service.resolveUrl(path)).toBe(`${service.mediaBaseUrl}/${path}`);
  });

  it('uses the logo profile and uploads the optimized file', done => {
    const original = new File([new Uint8Array(80)], 'clinic.png', { type: 'image/png' });
    const optimized = new File([new Uint8Array(20)], 'clinic.webp', { type: 'image/webp' });
    spyOn(imageOptimizer, 'optimizeLogo').and.resolveTo(optimized);

    service.uploadLogo(original).subscribe(path => {
      expect(path).toBe('logos/clinic.webp');
      done();
    });

    queueMicrotask(() => {
      const request = httpTesting.expectOne(req => req.url.endsWith('/media/upload'));
      const body = request.request.body as FormData;

      expect(imageOptimizer.optimizeLogo).toHaveBeenCalledOnceWith(original);
      expect(body.get('file')).toBe(optimized);
      expect(body.get('originalSize')).toBe(original.size.toString());
      request.flush({ path: 'logos/clinic.webp' });
    });
  });
});
