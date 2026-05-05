import { Pipe, PipeTransform } from '@angular/core';
import { LanguageStateService } from '../../services/language.state.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  constructor(private languageStateService: LanguageStateService) {}

  transform(key: string): string {
    return this.languageStateService.t(key);
  }
}