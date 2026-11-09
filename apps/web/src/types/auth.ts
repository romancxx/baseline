/** The signed-in user, from the API's `GET /users/me`. */
export type User = {
  readonly id: string;
  readonly email: string;
};
