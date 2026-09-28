import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { SOFTVET_BRAND_COLOR } from '../constants/branding.constants';

type Rgb = readonly [number, number, number];

@Injectable({ providedIn: 'root' })
export class BrandThemeService {
  private readonly document = inject(DOCUMENT);
  private currentColor = SOFTVET_BRAND_COLOR;

  applyCompanyColor(configuredColor: string | null | undefined): void {
    const primary = this.normalizeHex(configuredColor) ?? SOFTVET_BRAND_COLOR;
    const rgb = this.hexToRgb(primary);
    const root = this.document.documentElement;

    const palette: Record<number, Rgb> = {
      50: this.mix(rgb, [255, 255, 255], 0.96),
      100: this.mix(rgb, [255, 255, 255], 0.88),
      200: this.mix(rgb, [255, 255, 255], 0.70),
      300: this.mix(rgb, [255, 255, 255], 0.50),
      400: this.mix(rgb, [255, 255, 255], 0.25),
      500: rgb,
      600: this.mix(rgb, [0, 0, 0], 0.14),
      700: this.mix(rgb, [0, 0, 0], 0.27),
      800: this.mix(rgb, [0, 0, 0], 0.39),
      900: this.mix(rgb, [0, 0, 0], 0.50),
      950: this.mix(rgb, [0, 0, 0], 0.67),
    };

    Object.entries(palette).forEach(([shade, value]) => {
      root.style.setProperty(`--brand-${shade}`, value.join(' '));
    });
    root.style.setProperty('--brand-primary', this.rgbCss(palette[500]));
    root.style.setProperty('--brand-hover', this.rgbCss(palette[600]));
    root.style.setProperty('--brand-soft', this.rgbCss(palette[50]));
    root.style.setProperty('--brand-soft-strong', this.rgbCss(palette[100]));
    root.style.setProperty('--brand-border', this.rgbCss(palette[200]));

    this.currentColor = primary;
    this.updateThemeColor(primary);
  }

  primaryColor(): string {
    return this.currentColor;
  }

  private normalizeHex(value: string | null | undefined): string | null {
    const color = value?.trim();
    return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : null;
  }

  private hexToRgb(hex: string): Rgb {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }

  private mix(base: Rgb, target: Rgb, targetWeight: number): Rgb {
    return base.map((channel, index) =>
      Math.round(channel * (1 - targetWeight) + target[index] * targetWeight)
    ) as unknown as Rgb;
  }

  private rgbCss(rgb: Rgb): string {
    return `rgb(${rgb.join(' ')})`;
  }

  private updateThemeColor(color: string): void {
    let meta = this.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = this.document.createElement('meta');
      meta.name = 'theme-color';
      this.document.head.appendChild(meta);
    }
    meta.content = color;
  }
}
