import {Actions, createEffect,ofType} from "@ngrx/effects";
import {Injectable} from "@angular/core";
import {catchError, map, mergeMap, retry, switchMap, tap} from "rxjs/operators";
import {of} from "rxjs";
import {environment} from "../../../environments/environment";

import {HttpClient} from "@angular/common/http";
import {AuthResponseData} from "../auth-response-data.component";
import * as AuthActions from "./auth.actions";
import {Router} from "@angular/router";

@Injectable()
export class AuthEffects {

  authLogin$ = createEffect(() =>
      this.actions$.pipe(
        ofType(AuthActions.LOGIN_START),
        mergeMap((authData: AuthActions.LoginStart) => {
          return this.http
            .post<AuthResponseData>('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
              environment.firebaseAPIKey,
            {email: authData.payload.email, password: authData.payload.password, returnSecureToken: true})
            .pipe(
              map(responseData => {
                console.log(responseData)
                const expirationDate = new Date(new Date().getTime() + +responseData.expiresIn * 1000);
                return new AuthActions.Login({
                  email: responseData.email,
                  userId: responseData.localId,
                  token: responseData.idToken,
                  expirationDate: expirationDate
                });
              }),
              catchError(err => {
                let errorMessage = 'An unknown error occurred!';
                if (!err.error || !err.error.error) {
                  return of(new AuthActions.LoginFail(errorMessage));
                }
                switch (err.error.error.message) {
                  case 'EMAIL_EXISTS':
                    errorMessage = 'This email exists already';
                    break;
                  case 'EMAIL_NOT_FOUND':
                    errorMessage = 'This email does not exist.';
                    break;
                  case 'INVALID_PASSWORD':
                    errorMessage = 'This password is not correct.';
                    break;
                }
                return of(new AuthActions.LoginFail(errorMessage));
              })
            )
        })
      )
  );

  authSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.LOGIN),
      tap(() => {
        this.router.navigate(['/']);
      })
    ),
    {dispatch: false}
  );

  constructor(private actions$: Actions,
              private http: HttpClient,
              private router: Router) {
  }
}
