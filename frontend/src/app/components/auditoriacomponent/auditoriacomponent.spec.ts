import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Auditoriacomponent } from './auditoriacomponent';
import { EstadoPipe } from '../../pipes/estado-pipe';

describe('Auditoriacomponent', () => {
  let component: Auditoriacomponent;
  let fixture: ComponentFixture<Auditoriacomponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), FormsModule],
      declarations: [Auditoriacomponent, EstadoPipe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Auditoriacomponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
