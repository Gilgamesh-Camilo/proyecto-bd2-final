import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Catalogocomponent } from './catalogocomponent';
import { EstadoPipe } from '../../pipes/estado-pipe';
import { Tarjetalibrocomponent } from '../tarjetalibrocomponent/tarjetalibrocomponent';

describe('Catalogocomponent', () => {
  let component: Catalogocomponent;
  let fixture: ComponentFixture<Catalogocomponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), FormsModule],
      declarations: [Catalogocomponent, EstadoPipe, Tarjetalibrocomponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Catalogocomponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
