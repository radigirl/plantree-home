import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { LucideAngularModule, User } from 'lucide-angular';
import { Observable } from 'rxjs';
import { FamilyMember } from '../../models/family-member.model';
import { SupabaseService } from '../../services/supabase.service';
import { UserStateService } from '../../services/user.state.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  readonly userIcon = User;

  users: FamilyMember[] = [];
  currentUser$: Observable<FamilyMember | null>;
  isUserMenuOpen = false;

  constructor(
    private supabaseService: SupabaseService,
    private userStateService: UserStateService
  ) {
    this.currentUser$ = this.userStateService.currentUser$;
  }

  async ngOnInit(): Promise<void> {
    this.users = await this.supabaseService.getUsers();

    const currentUser = this.userStateService.getCurrentUser();

    if (!currentUser && this.users.length > 0) {
      this.userStateService.setCurrentUser(this.users[0]);
    }
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  selectUser(user: FamilyMember): void {
    this.userStateService.setCurrentUser(user);
    this.isUserMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.user-switcher')) {
      this.isUserMenuOpen = false;
    }
  }
}