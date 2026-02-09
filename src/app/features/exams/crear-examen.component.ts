import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamService } from '../../core/services/exam.service';
import { SectionService } from '../../core/services/section.service';
import { Examen, Pregunta, OpcionRespuesta, TipoPregunta } from '../../core/models/exam.model';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-crear-examen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-examen.component.html',
  styleUrl: './crear-examen.component.scss'
})
export class CrearExamenComponent implements OnInit {
  examenForm!: FormGroup;
  seccionId!: string;
  examenId?: string;
  isEdit = false;
  loading = false;
  cursoNombre = '';
  seccionNombre = '';

  tiposPreguntas: { value: TipoPregunta; label: string }[] = [
    { value: 'multiple_unica', label: 'Opción Múltiple (Respuesta Única)' },
    { value: 'multiple_multiple', label: 'Opción Múltiple (Múltiples Respuestas)' },
    { value: 'verdadero_falso', label: 'Verdadero/Falso' },
    { value: 'corta', label: 'Respuesta Corta' },
    { value: 'completar', label: 'Completar Espacio' }
  ];

  constructor(
    private fb: FormBuilder,
    private examService: ExamService,
    private sectionService: SectionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.seccionId = this.route.snapshot.paramMap.get('seccionId')!;
    this.examenId = this.route.snapshot.paramMap.get('id') || undefined;
    this.isEdit = !!this.examenId;

    this.initForm();
    this.loadSeccionInfo();

    if (this.isEdit && this.examenId) {
      this.loadExamen();
    }
  }

  initForm(): void {
    this.examenForm = this.fb.group({
      titulo: ['', Validators.required],
      descripcion: [''],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      duracionMinutos: [60, [Validators.required, Validators.min(1)]],
      intentosPermitidos: [1, [Validators.required, Validators.min(1)]],
      mezclarPreguntas: [false],
      mostrarRespuestas: [false],
      ponderacion: [10, [Validators.required, Validators.min(0)]],
      notaMinima: [60, [Validators.required, Validators.min(0), Validators.max(100)]],
      esExamenFinal: [false],
      visible: [true],
      preguntas: this.fb.array([])
    });
  }

  async loadSeccionInfo(): Promise<void> {
    try {
      const seccion = await this.sectionService.getSectionById(this.seccionId);
      if (seccion) {
        this.seccionNombre = seccion.titulo;
        // Simplemente usar el título de la sección
        // El cursoNombre se puede obtener de otra forma si es necesario
      }
    } catch (error) {
      console.error('Error loading section info:', error);
    }
  }

  async loadExamen(): Promise<void> {
    if (!this.examenId) return;

    try {
      this.loading = true;
      const examen = await this.examService.getExamById(this.examenId);

      if (examen) {
        this.examenForm.patchValue({
          titulo: examen.titulo,
          descripcion: examen.descripcion,
          fechaInicio: this.formatDateForInput(examen.fechaInicio),
          fechaFin: this.formatDateForInput(examen.fechaFin),
          duracionMinutos: examen.duracionMinutos,
          intentosPermitidos: examen.intentosPermitidos,
          mezclarPreguntas: examen.mezclarPreguntas,
          mostrarRespuestas: examen.mostrarRespuestas,
          ponderacion: examen.ponderacion,
          notaMinima: examen.notaMinima,
          esExamenFinal: examen.esExamenFinal || false,
          visible: examen.visible !== false
        });

        // Cargar preguntas
        examen.preguntas.forEach(pregunta => {
          this.addPreguntaFromData(pregunta);
        });
      }
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Error al cargar el examen');
    } finally {
      this.loading = false;
    }
  }

  formatDateForInput(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  get preguntas(): FormArray {
    return this.examenForm.get('preguntas') as FormArray;
  }

  getOpciones(preguntaIndex: number): FormArray {
    return this.preguntas.at(preguntaIndex).get('opciones') as FormArray;
  }

  addPregunta(): void {
    const preguntaForm = this.fb.group({
      id: [this.examService.generateQuestionId()],
      tipo: ['multiple_unica', Validators.required],
      texto: ['', Validators.required],
      puntos: [1, [Validators.required, Validators.min(0)]],
      opciones: this.fb.array([]),
      respuestaCorrecta: ['']
    });

    this.preguntas.push(preguntaForm);
    this.addOpcion(this.preguntas.length - 1); // Al menos una opción por defecto
  }

  addPreguntaFromData(pregunta: Pregunta): void {
    const preguntaForm = this.fb.group({
      id: [pregunta.id],
      tipo: [pregunta.tipo, Validators.required],
      texto: [pregunta.texto, Validators.required],
      puntos: [pregunta.puntos, [Validators.required, Validators.min(0)]],
      opciones: this.fb.array([]),
      respuestaCorrecta: [pregunta.respuestaCorrecta || '']
    });

    // Cargar opciones si existen
    if (pregunta.opciones) {
      pregunta.opciones.forEach(opcion => {
        const opcionForm = this.fb.group({
          id: [opcion.id],
          texto: [opcion.texto, Validators.required],
          esCorrecta: [opcion.esCorrecta]
        });
        (preguntaForm.get('opciones') as FormArray).push(opcionForm);
      });
    }

    this.preguntas.push(preguntaForm);
  }

  removePregunta(index: number): void {
    if (confirm('¿Está seguro de eliminar esta pregunta?')) {
      this.preguntas.removeAt(index);
    }
  }

  addOpcion(preguntaIndex: number): void {
    const opciones = this.getOpciones(preguntaIndex);
    const opcionForm = this.fb.group({
      id: [this.generateOptionId()],
      texto: ['', Validators.required],
      esCorrecta: [false]
    });
    opciones.push(opcionForm);
  }

  removeOpcion(preguntaIndex: number, opcionIndex: number): void {
    const opciones = this.getOpciones(preguntaIndex);
    opciones.removeAt(opcionIndex);
  }

  generateOptionId(): string {
    return 'opt_' + Math.random().toString(36).substr(2, 9);
  }

  generateId(): string {
    return 'q_' + Math.random().toString(36).substr(2, 9);
  }

  onTipoPreguntaChange(preguntaIndex: number): void {
    const pregunta = this.preguntas.at(preguntaIndex);
    const tipo = pregunta.get('tipo')?.value as TipoPregunta;
    const opciones = this.getOpciones(preguntaIndex);

    // Limpiar opciones
    while (opciones.length > 0) {
      opciones.removeAt(0);
    }

    // Si es verdadero/falso, agregar las dos opciones predeterminadas
    if (tipo === 'verdadero_falso') {
      const verdaderoForm = this.fb.group({
        id: ['vf_verdadero'],
        texto: ['Verdadero'],
        esCorrecta: [false]
      });
      const falsoForm = this.fb.group({
        id: ['vf_falso'],
        texto: ['Falso'],
        esCorrecta: [false]
      });
      opciones.push(verdaderoForm);
      opciones.push(falsoForm);
    } else if (tipo === 'multiple_unica' || tipo === 'multiple_multiple') {
      // Agregar opciones por defecto para múltiple
      for (let i = 0; i < 4; i++) {
        this.addOpcion(preguntaIndex);
      }
    }
  }

  mostrarOpciones(tipo: TipoPregunta): boolean {
    return tipo === 'multiple_unica' || tipo === 'multiple_multiple' || tipo === 'verdadero_falso';
  }

  mostrarRespuestaCorta(tipo: TipoPregunta): boolean {
    return tipo === 'corta' || tipo === 'completar';
  }

  async onSubmit(): Promise<void> {
    if (this.examenForm.invalid) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    if (this.preguntas.length === 0) {
      alert('Debe agregar al menos una pregunta');
      return;
    }

    try {
      this.loading = true;
      const formValue = this.examenForm.value;

      const examen: Omit<Examen, 'id'> = {
        seccionId: this.seccionId,
        titulo: formValue.titulo,
        descripcion: formValue.descripcion,
        fechaInicio: new Date(formValue.fechaInicio),
        fechaFin: new Date(formValue.fechaFin),
        duracionMinutos: formValue.duracionMinutos,
        intentosPermitidos: formValue.intentosPermitidos,
        mezclarPreguntas: formValue.mezclarPreguntas,
        mostrarRespuestas: formValue.mostrarRespuestas,
        ponderacion: formValue.ponderacion,
        notaMinima: formValue.notaMinima,
        esExamenFinal: formValue.esExamenFinal || false,
        visible: formValue.visible !== false,
        preguntas: this.preparePreguntas(formValue.preguntas),
        fechaCreacion: new Date()
      };

      if (this.isEdit && this.examenId) {
        await this.examService.updateExam(this.examenId, examen);
        alert('Examen actualizado exitosamente');
      } else {
        await this.examService.createExam(examen);
        alert('Examen creado exitosamente');
      }

      this.router.navigate(['/secciones', this.seccionId, 'examenes']);
    } catch (error) {
      console.error('Error saving exam:', error);
      alert('Error al guardar el examen');
    } finally {
      this.loading = false;
    }
  }

  preparePreguntas(preguntasForm: any[]): Pregunta[] {
    return preguntasForm.map(p => {
      let respuestaCorrecta: string | string[];

      // Determinar respuestas correctas según el tipo
      if (p.tipo === 'multiple_unica' || p.tipo === 'verdadero_falso') {
        const correcta = p.opciones.find((o: any) => o.esCorrecta);
        respuestaCorrecta = correcta ? correcta.id : '';
      } else if (p.tipo === 'multiple_multiple') {
        respuestaCorrecta = p.opciones
          .filter((o: any) => o.esCorrecta)
          .map((o: any) => o.id);
      } else if (p.tipo === 'corta' || p.tipo === 'completar') {
        respuestaCorrecta = p.respuestaCorrecta || '';
      } else {
        respuestaCorrecta = '';
      }

      const pregunta: Pregunta = {
        id: p.id,
        tipo: p.tipo,
        texto: p.texto,
        puntos: p.puntos,
        opciones: p.opciones || [],
        respuestaCorrecta: respuestaCorrecta
      };

      return pregunta;
    });
  }

  descargarPlantillaExcel(): void {
    // Datos de ejemplo para la plantilla
    const plantillaData = [
      {
        'Pregunta': '¿Cuál es la capital de Francia?',
        'Tipo': 'multiple_unica',
        'Opcion_A': 'Madrid',
        'Opcion_B': 'París',
        'Opcion_C': 'Londres',
        'Opcion_D': 'Berlín',
        'Respuesta_Correcta': 'B',
        'Puntos': 1,
        'Feedback': 'París es la capital de Francia'
      },
      {
        'Pregunta': 'Seleccione los continentes que existen',
        'Tipo': 'multiple_multiple',
        'Opcion_A': 'África',
        'Opcion_B': 'Atlantis',
        'Opcion_C': 'Europa',
        'Opcion_D': 'Asia',
        'Respuesta_Correcta': 'A,C,D',
        'Puntos': 2,
        'Feedback': 'Los continentes reales son África, Europa y Asia'
      },
      {
        'Pregunta': 'La Tierra es redonda',
        'Tipo': 'verdadero_falso',
        'Opcion_A': '',
        'Opcion_B': '',
        'Opcion_C': '',
        'Opcion_D': '',
        'Respuesta_Correcta': 'Verdadero',
        'Puntos': 1,
        'Feedback': 'La Tierra tiene forma esférica'
      },
      {
        'Pregunta': '¿Cuántos días tiene un año bisiesto?',
        'Tipo': 'corta',
        'Opcion_A': '',
        'Opcion_B': '',
        'Opcion_C': '',
        'Opcion_D': '',
        'Respuesta_Correcta': '366',
        'Puntos': 1,
        'Feedback': 'Un año bisiesto tiene 366 días'
      },
      {
        'Pregunta': 'El río más largo del mundo es el ___',
        'Tipo': 'completar',
        'Opcion_A': '',
        'Opcion_B': '',
        'Opcion_C': '',
        'Opcion_D': '',
        'Respuesta_Correcta': 'Nilo',
        'Puntos': 1,
        'Feedback': 'El río Nilo es el más largo del mundo'
      }
    ];

    // Crear workbook y worksheet
    const worksheet = XLSX.utils.json_to_sheet(plantillaData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Preguntas');

    // Ajustar ancho de columnas
    const columnWidths = [
      { wch: 50 }, // Pregunta
      { wch: 18 }, // Tipo
      { wch: 25 }, // Opcion_A
      { wch: 25 }, // Opcion_B
      { wch: 25 }, // Opcion_C
      { wch: 25 }, // Opcion_D
      { wch: 20 }, // Respuesta_Correcta
      { wch: 8 },  // Puntos
      { wch: 40 }  // Feedback
    ];
    worksheet['!cols'] = columnWidths;

    // Generar archivo Excel
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Descargar archivo
    saveAs(blob, 'plantilla_preguntas_examen.xlsx');
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          alert('El archivo Excel está vacío');
          return;
        }

        let preguntasImportadas = 0;
        const errores: string[] = [];

        jsonData.forEach((row, index) => {
          try {
            // Validar campos requeridos
            if (!row['Pregunta'] || !row['Tipo']) {
              errores.push(`Fila ${index + 2}: Falta "Pregunta" o "Tipo"`);
              return;
            }

            const tipo = row['Tipo'].toLowerCase().trim();
            if (!['multiple_unica', 'multiple_multiple', 'verdadero_falso', 'corta', 'completar'].includes(tipo)) {
              errores.push(`Fila ${index + 2}: Tipo "${row['Tipo']}" no válido`);
              return;
            }

            // Crear pregunta base
            const preguntaGroup = this.fb.group({
              id: [this.generateId()],
              tipo: [tipo as TipoPregunta, Validators.required],
              texto: [row['Pregunta'], Validators.required],
              puntos: [row['Puntos'] || 1, [Validators.required, Validators.min(0)]],
              opciones: this.fb.array([]),
              respuestaCorrecta: ['']
            });

            // Procesar según tipo de pregunta
            if (tipo === 'multiple_unica' || tipo === 'multiple_multiple') {
              const opciones: string[] = [];
              ['Opcion_A', 'Opcion_B', 'Opcion_C', 'Opcion_D'].forEach(key => {
                if (row[key]) opciones.push(row[key]);
              });

              if (opciones.length < 2) {
                errores.push(`Fila ${index + 2}: Debe tener al menos 2 opciones`);
                return;
              }

              // Agregar opciones al FormArray
              const opcionesArray = preguntaGroup.get('opciones') as FormArray;
              opciones.forEach((texto, idx) => {
                opcionesArray.push(this.fb.group({
                  id: [this.generateId()],
                  texto: [texto, Validators.required],
                  esCorrecta: [false]
                }));
              });

              // Establecer respuestas correctas
              const respuestaCorrecta = row['Respuesta_Correcta'];
              if (!respuestaCorrecta) {
                errores.push(`Fila ${index + 2}: Falta "Respuesta_Correcta"`);
                return;
              }

              if (tipo === 'multiple_unica') {
                // Para respuesta única, debe ser A, B, C o D
                const letra = respuestaCorrecta.toString().toUpperCase().trim();
                const indice = letra.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

                if (indice >= 0 && indice < opciones.length) {
                  opcionesArray.at(indice).patchValue({ esCorrecta: true });
                  preguntaGroup.patchValue({ respuestaCorrecta: opcionesArray.at(indice).value.id });
                } else {
                  errores.push(`Fila ${index + 2}: Respuesta "${letra}" no válida`);
                  return;
                }
              } else {
                // Para múltiples respuestas, puede ser "A,C" o "A, C"
                const letras = respuestaCorrecta.toString().toUpperCase().split(',').map((l: string) => l.trim());
                const idsCorrectos: string[] = [];

                letras.forEach((letra: string) => {
                  const indice = letra.charCodeAt(0) - 65;
                  if (indice >= 0 && indice < opciones.length) {
                    opcionesArray.at(indice).patchValue({ esCorrecta: true });
                    idsCorrectos.push(opcionesArray.at(indice).value.id);
                  }
                });

                if (idsCorrectos.length === 0) {
                  errores.push(`Fila ${index + 2}: No se encontraron respuestas válidas`);
                  return;
                }
                preguntaGroup.patchValue({ respuestaCorrecta: idsCorrectos.join(',') });
              }
            } else if (tipo === 'verdadero_falso') {
              // Agregar opciones Verdadero/Falso
              const opcionesArray = preguntaGroup.get('opciones') as FormArray;
              const idVerdadero = this.generateId();
              const idFalso = this.generateId();

              opcionesArray.push(this.fb.group({
                id: [idVerdadero],
                texto: ['Verdadero', Validators.required],
                esCorrecta: [false]
              }));

              opcionesArray.push(this.fb.group({
                id: [idFalso],
                texto: ['Falso', Validators.required],
                esCorrecta: [false]
              }));

              const respuesta = row['Respuesta_Correcta'].toString().toLowerCase();
              if (respuesta.includes('verdadero') || respuesta === 'v' || respuesta === 'true') {
                opcionesArray.at(0).patchValue({ esCorrecta: true });
                preguntaGroup.patchValue({ respuestaCorrecta: idVerdadero });
              } else if (respuesta.includes('falso') || respuesta === 'f' || respuesta === 'false') {
                opcionesArray.at(1).patchValue({ esCorrecta: true });
                preguntaGroup.patchValue({ respuestaCorrecta: idFalso });
              } else {
                errores.push(`Fila ${index + 2}: Respuesta debe ser "Verdadero" o "Falso"`);
                return;
              }
            } else if (tipo === 'corta' || tipo === 'completar') {
              // Para respuestas cortas, guardar el texto de la respuesta
              const respuesta = row['Respuesta_Correcta'];
              if (!respuesta) {
                errores.push(`Fila ${index + 2}: Falta "Respuesta_Correcta"`);
                return;
              }
              preguntaGroup.patchValue({ respuestaCorrecta: respuesta.toString() });
            }

            // Agregar pregunta al formulario
            this.preguntas.push(preguntaGroup);
            preguntasImportadas++;
          } catch (error) {
            errores.push(`Fila ${index + 2}: Error al procesar - ${error}`);
          }
        });

        // Mostrar resultado
        let mensaje = `Se importaron ${preguntasImportadas} preguntas correctamente.`;
        if (errores.length > 0) {
          mensaje += `\n\nErrores encontrados:\n${errores.slice(0, 5).join('\n')}`;
          if (errores.length > 5) {
            mensaje += `\n... y ${errores.length - 5} errores más`;
          }
        }
        alert(mensaje);

      } catch (error) {
        console.error('Error al procesar archivo:', error);
        alert('Error al procesar el archivo Excel. Verifica que el formato sea correcto.');
      }
    };

    reader.readAsArrayBuffer(file);
    // Resetear el input para permitir seleccionar el mismo archivo nuevamente
    event.target.value = '';
  }

  cancel(): void {
    this.router.navigate(['/secciones', this.seccionId, 'examenes']);
  }

  // Método para verificar si hay preguntas inválidas
  hasInvalidPreguntas(): boolean {
    return this.preguntas.controls.some(pregunta => pregunta.invalid);
  }

  // Método de debug para mostrar errores de validación
  showValidationErrors(): void {
    console.log('=== ESTADO DEL FORMULARIO ===');
    console.log('Formulario válido:', this.examenForm.valid);
    console.log('Errores generales:', this.examenForm.errors);

    Object.keys(this.examenForm.controls).forEach(key => {
      const control = this.examenForm.get(key);
      if (control?.invalid) {
        console.log(`Campo "${key}" inválido:`, control.errors);
      }
    });

    console.log('\n=== PREGUNTAS ===');
    this.preguntas.controls.forEach((pregunta, index) => {
      if (pregunta.invalid) {
        console.log(`Pregunta ${index + 1} inválida:`, pregunta.errors);
        Object.keys(pregunta.value).forEach(key => {
          const field = (pregunta as any).get(key);
          if (field?.invalid) {
            console.log(`  - Campo "${key}":`, field.errors);
          }
        });
      }
    });
  }
}
