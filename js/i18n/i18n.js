import { LOCALES } from './locales.js';

class I18n {
  constructor() {
    this.lang = 'fr';
  }

  setLang(lang) {
    this.lang = LOCALES[lang] ? lang : 'fr';
    this.applyToDOM();
  }

  t(key, vars = {}) {
    const dict = LOCALES[this.lang] || LOCALES.fr;
    let str = dict[key] ?? LOCALES.fr[key] ?? key;
    Object.keys(vars).forEach((k) => {
      str = str.replace(`{${k}}`, vars[k]);
    });
    return str;
  }

  applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.getAttribute('data-i18n'));
    });
  }
}

export const i18n = new I18n();
