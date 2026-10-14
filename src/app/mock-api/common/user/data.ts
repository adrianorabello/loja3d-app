/* tslint:disable:max-line-length */
import { User } from 'app/core/user/user.model';

/**
 * The default signed-in user.
 *
 * Now typed as `User` (it was `any`) and carries an explicit `role`, which Fuse's
 * model had no concept of. This is the ADMIN account; the CUSTOMER account and the
 * credential table live in `app/mock-api/clara-rosa/auth/data.ts`.
 */
export const user: User = {
    id    : 'cfaad35d-07a3-4447-a6c3-d8c3d54fd5df',
    name  : 'Clara Rosa Admin',
    email : 'admin@clararosa.pt',
    avatar: 'assets/images/avatars/brian-hughes.jpg',
    status: 'online',
    role  : 'ADMIN'
};
