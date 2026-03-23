import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  SwUpdate,
  VersionEvent,
  VersionReadyEvent,
} from '@angular/service-worker';
import { filter } from 'rxjs/operators';

import { HeaderComponent } from './shared/header/header.component';
import { NavigationComponent } from './shared/navigation/navigation.component';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, NavigationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent implements OnInit {
  updateAvailable = false;

  constructor(
    private supabase: SupabaseService,
    private updates: SwUpdate
  ) {}

  async ngOnInit(): Promise<void> {
    await this.supabase.getUsers();

    if (this.updates.isEnabled) {
      this.updates.versionUpdates
        .pipe(
          filter(
            (event: VersionEvent): event is VersionReadyEvent =>
              event.type === 'VERSION_READY'
          )
        )
        .subscribe(() => {
          this.updateAvailable = true;
        });

      this.updates.unrecoverable.subscribe((event) => {
        console.error('Unrecoverable service worker state:', event.reason);
        window.location.reload();
      });
    }
  }

  reloadApp(): void {
    window.location.reload();
  }
}