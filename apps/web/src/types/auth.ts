/** Which form the sign-in screen shows: `?mode=create` for Create account. */
export type SignInMode = "sign-in" | "create";

/** The signed-in user, from the API's `GET /users/me`. */
export type User = {
  readonly id: string;
  readonly email: string;
};
