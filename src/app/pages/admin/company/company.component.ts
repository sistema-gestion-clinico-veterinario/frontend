import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CompanyService } from '../../../core/services/company.service';
import { MediaService } from '../../../core/services/media.service';
import { RoleService } from '../../../core/services/role.service';
import { CompanyListResponse } from '../../../models/response/company-list-response';
import { CompanyDTO, CompanyOperatingHourDTO } from '../../../models/request/company-dto';
import { Role } from '../../../models/response/permission';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';

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
  private readonly mediaService = inject(MediaService);
  private readonly roleService = inject(RoleService);
  readonly authStore = inject(AuthStore);

  readonly isSuperAdmin = computed(() => this.authStore.isSuperAdmin());

  companies: CompanyListResponse[] = [];
  ownCompany: CompanyDTO | null = null;
  loadingOwnCompany = signal(false);
  displayModal: boolean = false;
  isEdit: boolean = false;
  loading: boolean = false;
  totalRecords: number = 0;
  companyPendingStatus: CompanyListResponse | null = null;

  companyRoles: Role[] = [];
  loadingRoles = signal(false);

  daysOfWeek = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

  sortOperatingHours(hours: CompanyOperatingHourDTO[]): CompanyOperatingHourDTO[] {
    return [...hours].sort(
      (a, b) => this.daysOfWeek.indexOf(a.diaSemana) - this.daysOfWeek.indexOf(b.diaSemana)
    );
  }

  companyForm: FormGroup = this.fb.group({
    id: [null],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100), noLeadingTrailingSpaceValidator()]],
    ruc: ['', [Validators.required, Validators.pattern('^(10|15|17|20)[0-9]{9}$')]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200), noLeadingTrailingSpaceValidator()]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    email: ['', [Validators.required, Validators.email, Validators.pattern(/^\S+@\S+\.\S+$/), Validators.maxLength(100)]],
    hasWebsite: [false],
    website: ['', [Validators.maxLength(200), noLeadingTrailingSpaceValidator()]],
    description: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator()]],
    businessHours: ['', [Validators.maxLength(100), noLeadingTrailingSpaceValidator()]],
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
    if (this.isSuperAdmin()) {
      this.loadCompanies();
    } else {
      this.loadOwnCompany();
      const companyId = this.authStore.companyId();
      if (companyId) this.loadCompanyRoles(companyId);
    }
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

  loadOwnCompany() {
    this.loadingOwnCompany.set(true);
    const companyId = this.authStore.companyId();
    if (!companyId) {
      this.messageService.add({ severity: 'warn', summary: 'Sin empresa', detail: 'No se encontró una empresa asociada a tu cuenta' });
      this.loadingOwnCompany.set(false);
      return;
    }
    this.companyService.getById(companyId).subscribe({
      next: (res) => {
        this.ownCompany = res.data;
        this.loadingOwnCompany.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información de tu empresa' });
        this.loadingOwnCompany.set(false);
      }
    });
  }

  private loadCompanyRoles(companyId: number) {
    this.loadingRoles.set(true);
    this.roleService.listarPorEmpresa(companyId).subscribe({
      next: (res) => {
        this.companyRoles = res.data;
        this.loadingRoles.set(false);
      },
      error: () => this.loadingRoles.set(false)
    });
  }

  openEditOwnCompany() {
    if (!this.ownCompany?.id) return;
    this.editCompany({ id: this.ownCompany.id } as CompanyListResponse);
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
          const sorted = [...data.operatingHours].sort(
            (a, b) => this.daysOfWeek.indexOf(a.diaSemana) - this.daysOfWeek.indexOf(b.diaSemana)
          );
          sorted.forEach((h: CompanyOperatingHourDTO) => {
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

  async saveCompany() {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Formulario inválido', detail: 'Revisa los campos resaltados en rojo.' });
      return;
    }

    this.loading = true;
    const formValue = this.companyForm.value;
    let logoUrl = formValue.logoUrl;

    // Upload logo first if a new file was selected
    const logo = this.logoFile();
    if (logo) {
      try {
        logoUrl = await new Promise<string>((resolve, reject) => {
          this.mediaService.upload(logo.file).subscribe({ next: resolve, error: reject });
        });
      } catch {
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir el logo' });
        return;
      }
    }

    const companyData: CompanyDTO = {
      ...formValue,
      logoUrl: logoUrl || '',
      website: formValue.hasWebsite && formValue.website ? (formValue.website.startsWith('http') ? formValue.website : `https://${formValue.website}`) : ''
    };

    const request = this.isEdit
      ? this.companyService.updateCompany(companyData)
      : this.companyService.saveCompany(companyData);

    request.subscribe({
      next: () => {
        this.logoFile.set(null);
        if (logoUrl && !this.isSuperAdmin()) {
          const current = this.authStore.selectedEnterprise();
          this.authStore.setSelectedEnterprise({
            establishmentId: current?.establishmentId ?? (this.authStore.companyId() ?? 0),
            name: current?.name ?? formValue.name ?? '',
            logoUrl
          });
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEdit ? 'Empresa actualizada' : 'Empresa creada'
        });
        this.displayModal = false;
        this.loading = false;
        if (this.isSuperAdmin()) {
          this.loadCompanies();
        } else {
          this.loadOwnCompany();
        }
      },
      error: () => {
        this.loading = false;
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

  readonly logoFile = signal<{ file: File; preview: string } | null>(null);
  isDragOver = signal(false);

  private processLogoFile(file: File) {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const maxSize = 5 * 1024 * 1024;
    if (!validTypes.includes(file.type)) {
      this.messageService.add({ severity: 'error', summary: 'Formato no válido', detail: 'Solo PNG, JPG, WEBP y GIF' });
      return;
    }
    if (file.size > maxSize) {
      this.messageService.add({ severity: 'error', summary: 'Archivo muy grande', detail: 'Máximo 5 MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.logoFile.set({ file, preview: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.processLogoFile(input.files[0]);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    if (event.dataTransfer?.files?.length) {
      this.processLogoFile(event.dataTransfer.files[0]);
    }
  }

  removeLogo() {
    this.logoFile.set(null);
    this.companyForm.patchValue({ logoUrl: '' });
  }

  resolveLogoUrl(path: string | null | undefined): string | null {
    return this.mediaService.resolveUrl(path);
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
