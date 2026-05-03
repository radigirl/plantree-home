import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  ChefHat,
  Utensils,
  Trophy,
  Bell,
  Settings,
  Info,
  LogOut,
  Globe,
  Users,
  ChevronRight,
  Check,
  UserRound,
  LucideAngularModule,
  ChevronDown,
  UserPlus,
} from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { Member } from '../../models/member.model';
import {
  AppLanguage,
  LanguageStateService,
} from '../../services/language.state.service';

type OpenMenuSection = 'members' | 'language' | 'settings' | 'account' | null;

@Component({
  selector: 'app-avatar-menu',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './avatar-menu.component.html',
  styleUrl: './avatar-menu.component.scss',
})
export class AvatarMenuComponent implements OnInit, OnDestroy, OnChanges {
  @Input() members: Member[] = [];
  @Input() currentMember: Member | null = null;
  @Input() closeSignal = 0;

  @Output() memberSelected = new EventEmitter<Member>();
  @Output() menuOpened = new EventEmitter<void>();

  readonly chefHatIcon = ChefHat;
  readonly myMealsIcon = Utensils;
  readonly statsIcon = Trophy;
  readonly bellIcon = Bell;
  readonly settingsIcon = Settings;
  readonly infoIcon = Info;
  readonly logoutIcon = LogOut;
  readonly globeIcon = Globe;
  readonly usersIcon = Users;
  readonly chevronRightIcon = ChevronRight;
  readonly chevronDownIcon = ChevronDown;
  readonly checkIcon = Check;
  readonly userIcon = UserRound;
  readonly userPlusIcon = UserPlus;

  isOpen = false;
  openSection: OpenMenuSection = null;

  currentLanguage: AppLanguage = 'en';

  languages: { code: AppLanguage; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'bg', label: 'Български' },
  ];

  isAccountSectionOpen = false;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private languageStateService: LanguageStateService
  ) { }

  ngOnInit(): void {
    this.languageStateService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((language) => {
        this.currentLanguage = language;
      });
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    const willOpen = !this.isOpen;
    this.isOpen = willOpen;
    if (willOpen) {
      this.menuOpened.emit();
    }
  }

  closeMenu(): void {
    this.isOpen = false;
    this.openSection = null;
    this.isAccountSectionOpen = false;
  }

  toggleSection(section: Exclude<OpenMenuSection, null>): void {
    if (this.openSection === section) {
      this.openSection = null;

      if (section === 'settings') {
        this.isAccountSectionOpen = false;
      }

      return;
    }

    this.openSection = section;

    if (section !== 'settings') {
      this.isAccountSectionOpen = false;
    }
  }

  toggleAccountSection(): void {
    this.isAccountSectionOpen = !this.isAccountSectionOpen;
  }

  selectMember(member: Member): void {
    if (member.id === this.currentMember?.id) {
      return;
    }

    this.memberSelected.emit(member);
  }

  selectLanguage(language: AppLanguage): void {
    if (language === this.currentLanguage) {
      return;
    }

    this.languageStateService.setLanguage(language);
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
    this.closeMenu();
  }

  logout(): void {
    console.log('Logout clicked');
    this.closeMenu();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  onAddMember(): void {
    console.log('Add member clicked');
  }

  onSettingsAction(action: string): void {
    console.log('Settings action clicked:', action);
  }

  onAccountAction(action: string): void {
    console.log('Account action:', action);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['closeSignal'] && !changes['closeSignal'].firstChange) {
      this.closeMenu();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}