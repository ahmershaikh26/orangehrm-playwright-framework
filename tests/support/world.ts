import type { Page } from 'playwright';

import type { AdminPage } from '../../src/pages/admin.page';
import type { SystemUsersPage } from '../../src/pages/system-users.page';
import type { AddUserPage } from '../../src/pages/add-user.page';

import type { LoginPage } from '../../src/pages/login.page';
import type { DashboardPage } from '../../src/pages/dashboard.page';

export type Pages = {
  login: LoginPage;
  dashboard: DashboardPage;

  admin: AdminPage;
  systemUsers: SystemUsersPage;
  addUser: AddUserPage;
};

export interface World {
  page: Page;

  /**
   * Lazily-initialized page objects container (preferred).
   * Provided by PlaywrightWorld in tests/support/playwright-world.ts as a getter.
   */
  pages?: Pages;

  /**
   * Backward-compatible direct properties (avoid using these for new steps).
   * Keep them optional so old steps don't break.
   */
  adminPage?: AdminPage;
  systemUsers?: SystemUsersPage;
  addUserPage?: AddUserPage;
}