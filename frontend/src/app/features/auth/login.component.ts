import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  template: `
    <div class="min-h-screen flex items-center justify-center bg-base-200">
      <div class="card w-96 bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-2xl justify-center">Invoice</h2>
          <p class="text-center text-base-content/60 mb-4">Sign in to your account</p>
          <form class="flex flex-col gap-4">
            <label class="floating-label">
              <input type="email" placeholder="Email" class="input input-bordered w-full" />
              <span>Email</span>
            </label>
            <label class="floating-label">
              <input type="password" placeholder="Password" class="input input-bordered w-full" />
              <span>Password</span>
            </label>
            <button type="submit" class="btn btn-primary w-full">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {}
