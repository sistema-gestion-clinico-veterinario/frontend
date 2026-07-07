import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MediaService } from './media.service';

describe('MediaService.resolveUrl', () => {
  let service: MediaService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(MediaService);
  });

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
});
