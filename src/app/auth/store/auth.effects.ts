import {Actions, createEffect,ofType} from "@ngrx/effects";
import {Injectable} from "@angular/core";
import {catchError, map, mergeMap, tap} from "rxjs/operators";
import {of} from "rxjs";
import {environment} from "../../../environments/environment";

import {HttpClient} from "@angular/common/http";
import {AuthResponseData} from "../auth-response-data.component";
import * as AuthActions from "./auth.actions";
import {Router} from "@angular/router";
import {User} from "../user.model";
import {AuthService} from "../auth.service";

const handleAuthentication = (expiresIn: number, email: string, userId: string, token: string) => {
  const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);
  const user = new User(email, userId, token, expirationDate);
  localStorage.setItem('userData', JSON.stringify(user));
  return new AuthActions.AuthenticateSuccess({
    email: email,
    userId: userId,
    token: token,
    expirationDate: expirationDate
  });
};

const handleError = (err: any) => {
  let errorMessage = 'An unknown error occurred!';
  if (!err.error || !err.error.error) {
    return of(new AuthActions.AuthenticateFail(errorMessage));
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
  return of(new AuthActions.AuthenticateFail(errorMessage));
};

const setExpirationDuration = () => {
  return new Date(userData._tokenExpirationDate).getTime() -
    new Date().getTime();
}

let userData: {
  email: string;
  id: string;
  _token: string;
  _tokenExpirationDate: string;
} = null;

@Injectable()
export class AuthEffects {

  authSignup$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.SIGNUP_START),
      mergeMap((authActions: AuthActions.SignupStart) => {
        return this.http
          .post<AuthResponseData>(
            'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=' +
            environment.firebaseAPIKey,
            {
              email: authActions.payload.email,
              password: authActions.payload.password,
              returnSecureToken: true
            }
          )
          .pipe(
            map(responseData => {
             return  handleAuthentication(+responseData.expiresIn, responseData.email, responseData.localId, responseData.idToken)
            }),
            catchError(err => {
              return handleError(err);
            })
          )
      })
    )
  );

  authLogin$ = createEffect(() =>
      this.actions$.pipe(
        ofType(AuthActions.LOGIN_START),
        mergeMap((authActions: AuthActions.LoginStart) => {
          return this.http
            .post<AuthResponseData>('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
              environment.firebaseAPIKey,
            {email: authActions.payload.email, password: authActions.payload.password, returnSecureToken: true})
            .pipe(
              tap(responseData => {
                this.authService.setLogoutTimer(+responseData.expiresIn * 1000);
              }),
              map(responseData => {
                return  handleAuthentication(+responseData.expiresIn, responseData.email, responseData.localId, responseData.idToken)
              }),
              catchError(err => {
                return handleError(err);
              })
            )
        })
      )
  );

  autoLogin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.AUTO_LOGIN),
      map(() => {
        userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData) {
          return { type: 'DUMMY' };
        }
        let loadedUser = new User(
          userData.email,
          userData.id,
          userData._token,
          new Date(userData._tokenExpirationDate)
        );

        if(loadedUser) {
          this.authService.setLogoutTimer(+setExpirationDuration() * 1000);
        }
        return loadedUser.token ?
          new AuthActions.AuthenticateSuccess({
            email: loadedUser.email,
            userId: loadedUser.id,
            token: loadedUser.token,
            expirationDate: new Date(userData._tokenExpirationDate)
          }) : {type: 'DUMMY' };
      })
    )
  );

  authRedirect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.AUTHENTICATE_SUCCESS),
      tap(() => {
        this.router.navigate(['/']);
      })
    ),
    {dispatch: false}
  );

  authLogout$ = createEffect(() =>
      this.actions$.pipe(
        ofType(AuthActions.LOGOUT, AuthActions.LOGOUT),
        tap(() => {
          this.authService.clearLogoutTimer();
          localStorage.removeItem('userData');
          this.router.navigate(['/auth']);
        })
      ),
    {dispatch: false}
  );

  constructor(private actions$: Actions, private http: HttpClient, private router: Router, private authService: AuthService) {
  }
}
