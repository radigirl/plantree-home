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
  ChevronDown
} from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { Member } from '../../models/member.model';
import {
  AppLanguage,
  LanguageStateService,
} from '../../services/language.state.service';
import { MemberStateService } from '../../services/member.state.service';
import { TranslatePipe } from '../pipes/translate.pipe';

type OpenMenuSection = 'language' | 'settings' | 'account' | null;

@Component({
  selector: 'app-avatar-menu',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslatePipe],
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

  isOpen = false;
  openSection: OpenMenuSection = null;

  currentLanguage: AppLanguage = 'en';

  languages: { code: AppLanguage; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'bg', label: 'Български' },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private languageStateService: LanguageStateService,
    private memberStateService: MemberStateService
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
  }

  toggleSection(section: Exclude<OpenMenuSection, null>): void {
    if (this.openSection === section) {
      this.openSection = null;
      return;
    }
    this.openSection = section;
  }

  selectMember(member: Member): void {
    if (member.id === this.currentMember?.id) {
      this.closeMenu();
      return;
    }

    this.memberSelected.emit(member);
    this.closeMenu();
  }

  async selectLanguage(language: AppLanguage): Promise<void> {
    if (language === this.currentLanguage) {
      this.closeMenu();
      return;
    }

    try {
      await this.memberStateService.setCurrentMemberLanguage(language);
      this.closeMenu();
    } catch (error) {
      console.error('Failed to save selected language', error);
    }
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

  onCurrentMemberClick(): void {
    console.log('Current member/profile clicked:', this.currentMember);
    this.closeMenu();
  }

  onSettingsAction(action: 'members' | 'spaces' | 'meals' | 'rules'): void {
    this.closeMenu();

    switch (action) {
      case 'spaces':
        this.router.navigate(['/settings/spaces']);
        break;

      case 'members':
        this.router.navigate(['/settings/members']);
        break;

      case 'meals':
        this.router.navigate(['/settings/meals']);
        break;

      case 'rules':
        this.router.navigate(['/settings/rules']);
        break;
    }
  }

  onAccountAction(action: 'edit-profile' | 'delete-account'): void {
    console.log('Account action clicked:', action);
    this.closeMenu();
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