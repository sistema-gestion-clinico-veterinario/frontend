import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { ProfileResponse } from '../../models/response/profile-response';

export interface ProfileUpdateRequest {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  observaciones?: string;
  fotoUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly apiUrl = `${environment.apiUrl}/profile`;

  constructor(private http: HttpClient) {}

  getProfile() {
    return this.http.get<ApiResponse<ProfileResponse>>(this.apiUrl);
  }

  getMySchedule() {
    return this.http.get<ApiResponse<ProfileResponse>>(`${this.apiUrl}/schedule`);
  }

  updateProfile(data: ProfileUpdateRequest) {
    return this.http.put<ApiResponse<ProfileResponse>>(this.apiUrl, data);
  }
}
