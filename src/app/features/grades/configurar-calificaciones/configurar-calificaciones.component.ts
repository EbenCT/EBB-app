import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GradingService } from '../../../core/services/grading.service';
import { ConfiguracionCalificacion } from '../../../core/models/grading.model';

@Component({
  selector: 'app-configurar-calificaciones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './configurar-calificaciones.component.html',
  styleUrl: './configurar-calificaciones.component.scss'
})
export class ConfigurarCalificacionesComponent implements OnInit {
  configForm!: FormGroup;
  cursoId!: string;
  loading = false;
  isEdit = false;
  configId?: string;

  constructor(
    private fb: FormBuilder,
    private gradingService: GradingService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cursoId = this.route.snapshot.paramMap.get('cursoId')!;
    this.initForm();
    this.loadConfig();
  }

  initForm(): void {
    this.configForm = this.fb.group({
      ponderacionTareas: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
      ponderacionExamenes: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
      ponderacionExamenFinal: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
      ponderacionAsistencia: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
      notaMinima: [70, [Validators.required, Validators.min(0), Validators.max(100)]],
      escalaExcelente: [90, [Validators.min(0), Validators.max(100)]],
      escalaBueno: [75, [Validators.min(0), Validators.max(100)]],
      escalaRegular: [60, [Validators.min(0), Validators.max(100)]]
    });

    // Validar que las ponderaciones sumen 100
    this.configForm.valueChanges.subscribe(() => {
      this.validarPonderaciones();
    });
  }

  validarPonderaciones(): void {
    const tareas = this.configForm.get('ponderacionTareas')?.value || 0;
    const examenes = this.configForm.get('ponderacionExamenes')?.value || 0;
    const examenFinal = this.configForm.get('ponderacionExamenFinal')?.value || 0;
    const asistencia = this.configForm.get('ponderacionAsistencia')?.value || 0;

    if (tareas + examenes + examenFinal + asistencia !== 100) {
      this.configForm.setErrors({ ponderacionInvalida: true });
    } else {
      if (this.configForm.hasError('ponderacionInvalida')) {
        this.configForm.setErrors(null);
      }
    }
  }

  async loadConfig(): Promise<void> {
    try {
      const config = await this.gradingService.getConfiguracionByCurso(this.cursoId);
      if (config) {
        this.isEdit = true;
        this.configId = config.id;
        this.configForm.patchValue({
          ponderacionTareas: config.ponderacionTareas,
          ponderacionExamenes: config.ponderacionExamenes,
          ponderacionExamenFinal: config.ponderacionExamenFinal || 0,
          ponderacionAsistencia: config.ponderacionAsistencia || 0,
          notaMinima: config.notaMinima,
          escalaExcelente: config.escalaCalificacion.excelente || 90,
          escalaBueno: config.escalaCalificacion.bueno || 75,
          escalaRegular: config.escalaCalificacion.regular || 60
        });
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.configForm.invalid) {
      alert('Por favor complete todos los campos correctamente. Las ponderaciones deben sumar 100%.');
      return;
    }

    this.loading = true;

    try {
      const formValue = this.configForm.value;
      const config: ConfiguracionCalificacion = {
        cursoId: this.cursoId,
        ponderacionTareas: formValue.ponderacionTareas,
        ponderacionExamenes: formValue.ponderacionExamenes,
        ponderacionExamenFinal: formValue.ponderacionExamenFinal || 0,
        ponderacionAsistencia: formValue.ponderacionAsistencia || 0,
        notaMinima: formValue.notaMinima,
        escalaCalificacion: {
          aprobado: formValue.notaMinima,
          desaprobado: formValue.notaMinima - 1,
          excelente: formValue.escalaExcelente,
          bueno: formValue.escalaBueno,
          regular: formValue.escalaRegular
        }
      };

      if (this.isEdit && this.configId) {
        await this.gradingService.updateConfiguracion(this.configId, config);
        alert('Configuración actualizada exitosamente');
      } else {
        await this.gradingService.createConfiguracion(config);
        alert('Configuración creada exitosamente');
      }

      this.router.navigate(['/cursos', this.cursoId, 'calificaciones']);
    } catch (error: any) {
      console.error('Error al guardar configuración:', error);
      alert('Error: ' + error.message);
    } finally {
      this.loading = false;
    }
  }

  ajustarPonderaciones(campo: 'tareas' | 'examenes'): void {
    const valor = this.configForm.get(campo === 'tareas' ? 'ponderacionTareas' : 'ponderacionExamenes')?.value || 0;
    const otroValor = 100 - valor;

    if (campo === 'tareas') {
      this.configForm.patchValue({ ponderacionExamenes: otroValor }, { emitEvent: false });
    } else {
      this.configForm.patchValue({ ponderacionTareas: otroValor }, { emitEvent: false });
    }

    this.validarPonderaciones();
  }

  volver(): void {
    this.router.navigate(['/cursos', this.cursoId]);
  }
}
