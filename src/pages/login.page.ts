import type { Page } from '@playwright/test';
import { InteractionUtil } from '../utils/interaction.util';
import { waitForCondition } from '../utils/wait.util';

export class LoginPage {
  page: Page;
  I: InteractionUtil;

  // XPaths / selectors centralized here (made more tolerant to minor text changes)
  selectors = {
    usernameInput: '//input[@name="username" or @placeholder="Username"]',
    passwordInput: '//input[@name="password" or @placeholder="Password"]',
    loginButton: '//button[contains(normalize-space(.),"Login") or @type="submit"]',
    forgotPasswordLink: '//a[contains(normalize-space(.),"Forgot") or contains(normalize-space(.),"forgot")]',
    credentialHintBox: '//div[contains(.,"Username") and contains(.,"Password")]',
    dashboardHeader: '//h6[contains(normalize-space(.),"Dashboard")]',
    loginError:
      '//*[contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"invalid credentials") or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"invalid") or contains(@class,"oxd-text--span")]',
  };

  constructor(page: Page) {
    this.page = page;
    this.I = new InteractionUtil(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(process.env.BASE_URL || '/');
    await this.I.waitForNavigation();
  }

  async enterUsername(username: string): Promise<void> {
    await this.I.type(this.selectors.usernameInput, username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.I.type(this.selectors.passwordInput, password);
  }

  async clickLoginButton(): Promise<void> {
    await this.I.click(this.selectors.loginButton);
    await this.I.waitForNavigation();
  }

  // convenience: complete flow
  async login(username: string, password: string): Promise<void> {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();
  }

  // use credentials from .env (no secrets in code)
  async loginWithEnvCredentials(): Promise<void> {
    const user = process.env.UI_USERNAME || '';
    const pass = process.env.UI_PASSWORD || '';
    await this.login(user, pass);
  }

  async clearUsername(): Promise<void> {
    const loc = this.I.locator(this.selectors.usernameInput);
    await loc.fill('');
  }

  async clearPassword(): Promise<void> {
    const loc = this.I.locator(this.selectors.passwordInput);
    await loc.fill('');
  }

  async isDashboardVisible(): Promise<boolean> {
    const selector = this.selectors.dashboardHeader;
    const visible = await waitForCondition(async () => {
      try {
        return await this.I.isVisible(selector);
      } catch {
        return false;
      }
    }, 10_000, 250);

    return Boolean(visible);
  }

  async isLoginErrorVisible(): Promise<boolean> {
    return this.I.isVisible(this.selectors.loginError);
  }

  async getLoginErrorText(): Promise<string> {
    const loc = this.I.locator(this.selectors.loginError);
    const txt = await loc.textContent();
    return (txt ?? '').trim();
  }

  async waitForLoginError(timeoutMs = 20_000, pollMs = 400): Promise<string> {
    const txt = await waitForCondition(
      async () => {
        try {
          const visible = await this.isLoginErrorVisible();
          if (!visible) return false;
          const t = await this.getLoginErrorText();
          return t ? t : false;
        } catch {
          return false;
        }
      },
      timeoutMs,
      pollMs
    );

    return String(txt || '').trim();
  }

  async hasUsernameField(): Promise<boolean> {
    return this.I.isVisible(this.selectors.usernameInput);
  }

  async hasPasswordField(): Promise<boolean> {
    return this.I.isVisible(this.selectors.passwordInput);
  }

  async hasForgotPasswordLink(): Promise<boolean> {
    return this.I.isVisible(this.selectors.forgotPasswordLink);
  }

  async getCredentialHintText(): Promise<string> {
    return this.I.getText(this.selectors.credentialHintBox);
  }

  async waitForLoginForm(timeout = 8000): Promise<void> {
    const loc = this.I.locator(this.selectors.usernameInput);
    await loc.waitFor({ state: 'visible', timeout });
  }
}