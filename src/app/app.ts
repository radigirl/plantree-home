import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { NavigationComponent } from './shared/navigation/navigation.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, NavigationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent {}