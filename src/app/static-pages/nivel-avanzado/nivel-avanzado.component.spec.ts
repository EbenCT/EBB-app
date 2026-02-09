import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NivelAvanzadoComponent } from './nivel-avanzado.component';

describe('NivelAvanzadoComponent', () => {
  let component: NivelAvanzadoComponent;
  let fixture: ComponentFixture<NivelAvanzadoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NivelAvanzadoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NivelAvanzadoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
