import { mainBundle } from './app-version.service';

describe('mainBundle', () => {
  it('finds the hashed main bundle of an index.html', () => {
    const html = '<script src="polyfills-AB12.js" type="module"></script><script src="main-3XK2QF7A.js" type="module"></script>';
    expect(mainBundle(html)).toBe('main-3XK2QF7A.js');
  });

  it('reports none for an unhashed development build', () => {
    expect(mainBundle('<script src="main.js" type="module"></script>')).toBeNull();
  });
});
