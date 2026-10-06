import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CompanyService } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { SOFTVET_BRAND_COLOR, SOFTVET_LOGO_URL, SOFTVET_NAME } from '../../../core/constants/branding.constants';

@Component({
  selector: 'app-account-closed',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './account-closed.component.html'
})
export class AccountClosedComponent implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly slugContext = inject(CompanySlugContext);

  companyName = SOFTVET_NAME;
  logoUrl: string | null = SOFTVET_LOGO_URL;
  colorPrimario = SOFTVET_BRAND_COLOR;

  ngOnInit(): void {
    const slug = this.slugContext.slug();
    if (!slug) return;
    this.companyService.getBrandingBySlug(slug).subscribe({
      next: ({ data }) => {
        this.companyName = data?.name || SOFTVET_NAME;
        this.logoUrl = data?.logoUrl || SOFTVET_LOGO_URL;
        this.colorPrimario = data?.colorPrimario || SOFTVET_BRAND_COLOR;
      },
      error: () => {}
    });
  }
}
