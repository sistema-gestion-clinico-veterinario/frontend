import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LaboratorioIAResponse } from '../../models/response/laboratorio-ia-response';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({ providedIn: 'root' })
export class LaboratorioIaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/laboratorio/analizar`;

  analizar(archivo: File, especie: string): Observable<LaboratorioIAResponse> {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('especie', especie);

    return this.http
      .post<ApiResponse<LaboratorioIAResponse>>(this.url, form)
      .pipe(map(r => r.data));
  }
}
