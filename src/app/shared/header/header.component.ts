import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { LucideAngularModule, User } from 'lucide-angular';
import { Observable } from 'rxjs';
import { Member } from '../../models/member.model';
import { SupabaseService } from '../../services/supabase.service';
import { MemberStateService} from '../../services/member.state.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  readonly userIcon = User;

  members: Member[] = [];
  currentMember$: Observable<Member | null>;
  isUserMenuOpen = false;

  constructor(
    private supabaseService: SupabaseService,
    private memberStateService: MemberStateService
  ) {
    this.currentMember$ = this.memberStateService.currentMember$;
  }

  async ngOnInit(): Promise<void> {
    this.members = await this.supabaseService.getMembers();

    const currentMember = this.memberStateService.getCurrentMember();

    if (!currentMember && this.members.length > 0) {
      this.memberStateService.setCurrentMember(this.members[1]); // TO DO: change to 0 temporary
    }
  }

  toggleMemberMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  selectMember(member: Member): void {
    this.memberStateService.setCurrentMember(member);
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