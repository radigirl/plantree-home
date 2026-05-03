import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppLanguage = 'en' | 'bg';

@Injectable({
  providedIn: 'root',
})
export class LanguageStateService {
  private readonly storageKey = 'plantree-language';

  private readonly currentLanguageSubject = new BehaviorSubject<AppLanguage>(
    this.getInitialLanguage()
  );

  currentLanguage$ = this.currentLanguageSubject.asObservable();

  get currentLanguage(): AppLanguage {
    return this.currentLanguageSubject.value;
  }

  setLanguage(language: AppLanguage): void {
    this.currentLanguageSubject.next(language);
    localStorage.setItem(this.storageKey, language);
  }

  private getInitialLanguage(): AppLanguage {
    const savedLanguage = localStorage.getItem(this.storageKey);

    if (savedLanguage === 'bg' || savedLanguage === 'en') {
      return savedLanguage;
    }

    return 'en';
  }
}