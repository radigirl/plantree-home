import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { en } from '../i18n/en';
import { bg } from '../i18n/bg';

export type AppLanguage = 'en' | 'bg';

@Injectable({
  providedIn: 'root',
})
export class LanguageStateService {
  private currentLanguageSubject = new BehaviorSubject<AppLanguage>('en');
  currentLanguage$ = this.currentLanguageSubject.asObservable();

  private translationsMap = {
    en,
    bg,
  };

  private currentTranslations = en;

  setLanguage(lang: AppLanguage): void {
    this.currentLanguageSubject.next(lang);
    this.currentTranslations = this.translationsMap[lang];
  }

  getLanguage(): AppLanguage {
    return this.currentLanguageSubject.value;
  }

  t(path: string): string {
    return path
      .split('.')
      .reduce((obj: any, key) => obj?.[key], this.currentTranslations) || path;
  }
}