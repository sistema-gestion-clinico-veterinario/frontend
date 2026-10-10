import { HttpContextToken } from '@angular/common/http';

/** La pantalla que origina la solicitud ya muestra su propio estado de proceso. */
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);
