import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { CalendarDays, ShoppingCart,  Refrigerator, ShieldCheck, FileText, Mail, LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LucideAngularModule],
  templateUrl: './about-page.component.html',
  styleUrls: ['./about-page.component.scss'],
})
export class AboutPageComponent {
  readonly planIcon = CalendarDays;
  readonly listsIcon = ShoppingCart;
  readonly pantryIcon =  Refrigerator;
  readonly privacyIcon = ShieldCheck;
  readonly termsIcon = FileText;
  readonly contactIcon = Mail;
}