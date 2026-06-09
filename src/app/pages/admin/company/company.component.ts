import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CompanyService } from '../../../core/services/company.service';
import { CompanyListResponse } from '../../../models/response/company-list-response';
import { CompanyDTO, CompanyOperatingHourDTO } from '../../../models/request/company-dto';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    Toast,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './company.component.html',
  styleUrl: './company.component.scss'
})
export class CompanyComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);

  companies: CompanyListResponse[] = [];
  displayModal: boolean = false;
  isEdit: boolean = false;
  loading: boolean = false;
  totalRecords: number = 0;
  companyPendingStatus: CompanyListResponse | null = null;

  daysOfWeek = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

  companyForm: FormGroup = this.fb.group({
    id: [null],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    ruc: ['', [Validators.required, Validators.pattern('^(10|15|17|20)[0-9]{9}$')]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    hasWebsite: [false],
    website: ['', [Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(500)]],
    businessHours: ['', [Validators.maxLength(100)]],
    logoUrl: [''],
    operatingHours: this.fb.array([])
  });

  get operatingHours() {
    return this.companyForm.get('operatingHours') as FormArray;
  }

  private initOperatingHours() {
    this.operatingHours.clear();
    this.daysOfWeek.forEach(day => {
      this.operatingHours.push(this.fb.group({
        diaSemana: [day],
        openingTime: ['08:00', Validators.required],
        closingTime: ['18:00', Validators.required],
        isOpen: [true]
      }, { validators: this.rangoHorarioValidator }));
    });
  }

  ngOnInit() {
    this.loadCompanies();
  }

  loadCompanies(event: any = { first: 0, rows: 10 }) {
    const page = event.first / event.rows;
    this.loading = true;
    this.companyService.listar(page, event.rows).subscribe({
      next: (res) => {
        this.companies = res.data.content;
        this.totalRecords = res.data?.page?.totalElements ?? res.data?.totalElements ?? 0;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las empresas' });
        this.loading = false;
      }
    });
  }

  openNew() {
    this.companyForm.reset();
    this.initOperatingHours();
    this.isEdit = false;
    this.displayModal = true;
  }

  editCompany(company: CompanyListResponse) {
    this.isEdit = true;
    this.loading = true;
    this.companyService.getById(company.id).subscribe({
      next: (res) => {
        const data = res.data;
        this.companyForm.patchValue({
          ...data,
          hasWebsite: !!data.website
        });
        
        this.operatingHours.clear();
        if (data.operatingHours && data.operatingHours.length > 0) {
          data.operatingHours.forEach((h: CompanyOperatingHourDTO) => {
            this.operatingHours.push(this.fb.group({
              diaSemana: [h.diaSemana],
              openingTime: [h.openingTime],
              closingTime: [h.closingTime],
              isOpen: [h.isOpen]
            }, { validators: this.rangoHorarioValidator }));
          });
        } else {
          this.initOperatingHours();
        }

        this.displayModal = true;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información de la empresa' });
        this.loading = false;
      }
    });
  }

  saveCompany() {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Formulario inválido', detail: 'Revisa los campos resaltados en rojo.' });
      return;
    }

    const formValue = this.companyForm.value;
    const companyData: CompanyDTO = {
      ...formValue,
      website: formValue.hasWebsite && formValue.website ? (formValue.website.startsWith('http') ? formValue.website : `https://${formValue.website}`) : ''
    };
    const request = this.isEdit
      ? this.companyService.updateCompany(companyData)
      : this.companyService.saveCompany(companyData);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEdit ? 'Empresa actualizada' : 'Empresa creada'
        });
        this.displayModal = false;
        this.loadCompanies();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Ocurrió un error al guardar' });
      }
    });
  }

  rangoHorarioValidator(control: AbstractControl): ValidationErrors | null {
    const isOpen = control.get('isOpen')?.value;
    const openingTime = control.get('openingTime')?.value;
    const closingTime = control.get('closingTime')?.value;
    if (!isOpen) return null;
    if (!openingTime || !closingTime) return { horarioIncompleto: true };
    return closingTime > openingTime ? null : { horarioInvalido: true };
  }

  confirmToggleActivo(company: CompanyListResponse) {
    this.companyPendingStatus = company;
  }

  cancelToggleActivo() {
    this.companyPendingStatus = null;
  }

  toggleActivo() {
    const company = this.companyPendingStatus;
    if (!company) return;

    this.companyService.toggleActivo(company.id).subscribe({
      next: (res) => {
        company.activo = res.data.activo;
        this.companyPendingStatus = null;
        this.messageService.add({
          severity: company.activo ? 'success' : 'warn',
          summary: company.activo ? 'Empresa activada' : 'Empresa desactivada',
          detail: `${company.name} fue ${company.activo ? 'activada' : 'desactivada'}. Los usuarios de esta empresa ${company.activo ? 'ya pueden' : 'no pueden'} iniciar sesión.`
        });
      },
      error: () => {
        this.companyPendingStatus = null;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado de la empresa' });
      }
    });
  }
}
