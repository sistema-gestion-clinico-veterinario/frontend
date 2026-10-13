import { Injectable, inject } from '@angular/core';
import { DefaultUrlSerializer, UrlSerializer, UrlTree } from '@angular/router';
import { CompanySlugContext } from '../services/company-slug-context.service';
import { companySlugFromUrl, firstSegmentOf, pathnameOf } from './slug-url.utils';

@Injectable()
export class SlugUrlSerializer extends UrlSerializer {
  private readonly inner = new DefaultUrlSerializer();
  private readonly slugContext = inject(CompanySlugContext);

  override parse(url: string): UrlTree {
    const pathname = pathnameOf(url);
    const first = firstSegmentOf(pathname);

    if (!first || !companySlugFromUrl(url)) {
      return this.inner.parse(url);
    }


    const hashIndex = url.indexOf('#');
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const queryIndex = withoutHash.indexOf('?');
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';

    const segments = pathname.split('/').filter(Boolean);
    const restPathname = '/' + segments.slice(1).join('/');
    return this.inner.parse(`${restPathname}${query}${hash}`);
  }

  override serialize(tree: UrlTree): string {
    const url = this.inner.serialize(tree);

    if (pathnameOf(url) === '/admin/login') {
      return url;
    }

    const slug = this.slugContext.slug();
    if (!slug) {
      return url;
    }

    return `/${slug}${url === '/' ? '' : url}`;
  }
}
