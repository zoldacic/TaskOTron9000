import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Sends the login cookie with every API call (needed once frontend and backend are on different
 * origins — harmless when a dev-server proxy makes them look same-origin), and notices when a
 * call comes back 401 so a cookie that expired mid-session flips the app back to the login screen.
 */
export const httpAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req.clone({ withCredentials: true })).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) auth.markLoggedOut();
      return throwError(() => err);
    }),
  );
};
