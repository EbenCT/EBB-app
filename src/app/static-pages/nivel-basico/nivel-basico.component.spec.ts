import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NivelBasicoComponent } from './nivel-basico.component';

describe('NivelBasicoComponent', () => {
  let component: NivelBasicoComponent;
  let fixture: ComponentFixture<NivelBasicoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NivelBasicoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NivelBasicoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
