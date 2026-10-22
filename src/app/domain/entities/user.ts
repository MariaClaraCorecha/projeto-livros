export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly photoUrl: string | null;
  readonly isGuest: boolean;
}
