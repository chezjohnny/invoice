import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  const login = vi.fn();
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    login.mockReset();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideZonelessChangeDetection(), { provide: AuthService, useValue: { login } }],
    });
    fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
  });

  async function signIn(email: string, password: string): Promise<void> {
    const [emailBox, passwordBox] = [...element().querySelectorAll('input')] as HTMLInputElement[];
    for (const [box, value] of [[emailBox, email], [passwordBox, password]] as const) {
      box.value = value;
      box.dispatchEvent(new Event('input'));
    }
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('asks for an email and a password before calling the server', async () => {
    await signIn('', '');
    expect(login).not.toHaveBeenCalled();
    expect(element().querySelectorAll('.text-error').length).toBe(2);
  });

  it('signs in', async () => {
    login.mockReturnValue(of(undefined));
    await signIn(' admin@cave.ch ', 'secret123');
    expect(login).toHaveBeenCalledWith('admin@cave.ch', 'secret123');
  });

  it('tells a server failure from wrong credentials', async () => {
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    await signIn('admin@cave.ch', 'secret123');
    expect(element().querySelector('[role="alert"]')?.textContent).not.toContain('mot de passe');
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    await signIn('admin@cave.ch', 'wrong-password');
    expect(element().querySelector('[role="alert"]')?.textContent).toContain('mot de passe');
  });
});
