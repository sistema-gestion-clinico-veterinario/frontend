import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { CompanyService } from '../../../core/services/company.service';
import { CompanyListResponse } from '../../../models/response/company-list-response';
import { CompanyDTO } from '../../../models/request/company-dto';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ToastModule,
    CheckboxModule
  ],
  providers: [MessageService],
  templateUrl: './company.component.html',
  styleUrls: ['./company.component.scss']
})
export class CompanyComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);

  companies: CompanyListResponse[] = [];
  displayModal: boolean = false;
  isEdit: boolean = false;
  loading: boolean = false;
  totalRecords: number = 0;

  companyForm: FormGroup = this.fb.group({
    id: [null],
    name: ['', [Validators.required]],
    ruc: ['', [Validators.required, Validators.pattern('^[0-9]{11}$')]],
    address: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    hasWebsite: [false],
    website: [''],
    description: [''],
    businessHours: [''],
    logoUrl: ['']
  });

  ngOnInit() {
    this.loadCompanies();
  }

  loadCompanies(event: any = { first: 0, rows: 10 }) {
    const page = event.first / event.rows;
    this.loading = true;
    this.companyService.listar(page, event.rows).subscribe({
      next: (res) => {
        this.companies = res.data.content;
        this.totalRecords = res.data.totalElements;
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
      return;
    }

    const formValue = this.companyForm.value;
    const companyData: CompanyDTO = {
      ...formValue,
      website: formValue.hasWebsite ? formValue.website : ''
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
}
