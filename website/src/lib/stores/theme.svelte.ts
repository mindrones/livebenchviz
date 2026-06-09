import { browser } from '$app/environment';

class ThemeState {
  isDark = $state(true);

  constructor() {
    if (browser) {
      const saved = localStorage.getItem('app-theme');
      if (saved) {
        this.isDark = saved === 'dark';
      } else {
        this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      this.applyTheme();

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('app-theme')) {
          this.isDark = e.matches;
          this.applyTheme();
        }
      });
    }
  }

  toggle() {
    this.isDark = !this.isDark;
    if (browser) {
      localStorage.setItem('app-theme', this.isDark ? 'dark' : 'light');
      this.applyTheme();
    }
  }

  applyTheme() {
    if (!browser) return;
    if (this.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}

export const theme = new ThemeState();
