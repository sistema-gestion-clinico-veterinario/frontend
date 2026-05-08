import { Component, Input, Output, EventEmitter, inject, signal, HostListener, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Menu } from '../../../../models/response/auth-login-response.model';
import { Permission } from '../../../../models/response/permission';
import { PRIME_ICONS } from '../../../../core/constants/icons.constant';

@Component({
  selector: 'app-menu-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './menu-form.component.html',
  styleUrl: './menu-form.component.scss'
})
export class MenuFormComponent implements OnChanges {
  private el = inject(ElementRef);
  private fb = inject(FormBuilder);

  @Input() initialData: Partial<Menu> | null = null;
  @Input() permissions: Permission[] = [];
  @Input() menuOptions: {id: number, label: string}[] = [];
  @Input() isEdit = false;

  @Output() onSave = new EventEmitter<any>();
  @Output() onClose = new EventEmitter<void>();

  showPicker = signal(false);
  showPerms = signal(false);
  showParents = signal(false);
  allIcons = PRIME_ICONS;

  private readonly DEFAULTS = {
    label: '',
    icon: 'pi pi-circle',
    path: '',
    sortOrder: 1,
    parentId: undefined as number | undefined,
    requiredPermission: undefined as string | undefined,
    active: true
  };

  form = this.fb.group({
    label: ['', Validators.required],
    icon: ['pi pi-circle'],
    path: [''],
    sortOrder: [1],
    parentId: [undefined as number | undefined],
    requiredPermission: [undefined as string | undefined],
    active: [true]
  });

  ngOnChanges(changes: SimpleChanges): void {
    if ('initialData' in changes) {
      const value = changes['initialData'].currentValue as Partial<Menu> | null;
      
      this.form.reset(this.DEFAULTS);
      this.form.markAsUntouched();
      this.form.markAsPristine();

      if (value) {
        this.form.patchValue(value);
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) this.closeAll();
  }

  closeAll() {
    this.showPicker.set(false);
    this.showPerms.set(false);
    this.showParents.set(false);
  }

  togglePicker(event: Event) {
    event.stopPropagation();
    const current = this.showPicker();
    this.closeAll();
    this.showPicker.set(!current);
  }

  togglePerms(event: Event) {
    event.stopPropagation();
    const current = this.showPerms();
    this.closeAll();
    this.showPerms.set(!current);
  }

  toggleParents(event: Event) {
    event.stopPropagation();
    const current = this.showParents();
    this.closeAll();
    this.showParents.set(!current);
  }

  selectIcon(icon: string) {
    this.form.get('icon')?.setValue(icon);
    this.showPicker.set(false);
  }

  selectPerm(perm: string | undefined) {
    this.form.get('requiredPermission')?.setValue(perm);
    this.showPerms.set(false);
  }

  selectParent(id: number | undefined) {
    this.form.get('parentId')?.setValue(id);
    this.showParents.set(false);
  }

  get currentPermLabel(): string {
    const val = this.form.get('requiredPermission')?.value;
    if (!val) return 'Público';
    return this.permissions.find(p => p.name === val)?.label || val;
  }

  get currentParentLabel(): string {
    const val = this.form.get('parentId')?.value;
    if (!val) return 'Nivel Principal (Raíz)';
    return this.menuOptions.find(o => o.id === Number(val))?.label || val?.toString() || 'Nivel Principal (Raíz)';
  }

  get labelHasError(): boolean {
    const ctrl = this.form.get('label');
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  close() {
    this.form.reset(this.DEFAULTS);
    this.form.markAsUntouched();
    this.form.markAsPristine();
    this.onClose.emit();
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.value;
    this.onSave.emit({
      ...value,
      path: value.path?.trim() || null
    });

    this.form.reset(this.DEFAULTS);
    this.form.markAsUntouched();
    this.form.markAsPristine();
  }
}
