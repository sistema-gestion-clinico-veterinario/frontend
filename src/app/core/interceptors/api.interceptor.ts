import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const loadingStore = inject(LoadingStore);

  loadingStore.show();

  const token = authStore.token();
  const enterpriseId = authStore.selectedEnterprise()?.establishmentId;

  const authReq = req.clone({
    setHeaders: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  return next(authReq).pipe(
    finalize(() => loadingStore.hide())
  );
};
