import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Socioscomponent } from './socioscomponent';
import { EstadoPipe } from '../../pipes/estado-pipe';

describe('Socioscomponent', () => {
  let component: Socioscomponent;
  let fixture: ComponentFixture<Socioscomponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), FormsModule],
      declarations: [Socioscomponent, EstadoPipe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Socioscomponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
