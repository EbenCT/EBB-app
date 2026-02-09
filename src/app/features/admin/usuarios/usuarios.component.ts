import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { UserModel, UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss'
})
export class UsuariosComponent implements OnInit {
  usuarios: UserModel[] = [];
  usuariosFiltrados: UserModel[] = [];
  loading = true;

  // Filtros
  searchTerm = '';
  filterRole: UserRole | 'todos' = 'todos';
  filterStatus: 'todos' | 'activos' | 'inactivos' = 'todos';

  // Modales
  selectedUser: UserModel | null = null;
  showEditModal = false;
  showCreateModal = false;
  showViewModal = false;

  // Nuevo usuario
  newUser = {
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: 'estudiante' as UserRole,
    fotoPerfil: ''
  };

  // Preview y upload de imágenes
  imagePreviewCreate: string | null = null;
  imagePreviewEdit: string | null = null;
  uploadingImage = false;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private cloudinaryService: CloudinaryService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        // Convertir Timestamps de Firebase a Date
        this.usuarios = users.map(user => ({
          ...user,
          fechaRegistro: user.fechaRegistro instanceof Date
            ? user.fechaRegistro
            : (user.fechaRegistro as any).toDate()
        })).sort((a, b) =>
          new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime()
        );
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando usuarios:', error);
        this.loading = false;
      }
    });
  }

  applyFilters() {
    this.usuariosFiltrados = this.usuarios.filter(user => {
      // Filtro de búsqueda
      const searchMatch = !this.searchTerm ||
        user.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.apellido.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase());

      // Filtro de rol
      const roleMatch = this.filterRole === 'todos' || user.rol === this.filterRole;

      // Filtro de estado
      const statusMatch = this.filterStatus === 'todos' ||
        (this.filterStatus === 'activos' && user.activo) ||
        (this.filterStatus === 'inactivos' && !user.activo);

      return searchMatch && roleMatch && statusMatch;
    });
  }

  getRoleBadgeClass(role: UserRole): string {
    const classes: { [key in UserRole]: string } = {
      'admin': 'bg-danger',
      'profesor': 'bg-success',
      'estudiante': 'bg-primary'
    };
    return classes[role];
  }

  getRoleLabel(role: UserRole): string {
    const labels: { [key in UserRole]: string } = {
      'admin': 'Administrador',
      'profesor': 'Profesor',
      'estudiante': 'Estudiante'
    };
    return labels[role];
  }

  async changeRole(user: UserModel, newRole: UserRole) {
    if (confirm(`¿Cambiar rol de ${user.nombre} ${user.apellido} a ${this.getRoleLabel(newRole)}?`)) {
      try {
        await this.userService.changeUserRole(user.id, newRole);
      } catch (error) {
        console.error('Error cambiando rol:', error);
        alert('Error al cambiar el rol');
      }
    }
  }

  async toggleStatus(user: UserModel) {
    const action = user.activo ? 'desactivar' : 'activar';
    if (confirm(`¿Está seguro de ${action} a ${user.nombre} ${user.apellido}?`)) {
      try {
        await this.userService.toggleUserStatus(user.id, !user.activo);
      } catch (error) {
        console.error('Error cambiando estado:', error);
        alert('Error al cambiar el estado');
      }
    }
  }

  openCreateModal() {
    this.newUser = {
      nombre: '',
      apellido: '',
      email: '',
      password: '',
      rol: 'estudiante',
      fotoPerfil: ''
    };
    this.imagePreviewCreate = null;
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.imagePreviewCreate = null;
    this.newUser = {
      nombre: '',
      apellido: '',
      email: '',
      password: '',
      rol: 'estudiante',
      fotoPerfil: ''
    };
  }

  async onImageSelectedCreate(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!this.cloudinaryService.isValidImageFile(file)) {
        return;
      }

      // Mostrar preview local
      this.imagePreviewCreate = this.cloudinaryService.createImagePreview(file);

      // Subir a Cloudinary
      try {
        this.uploadingImage = true;
        const imageUrl = await this.cloudinaryService.uploadImage(file);
        this.newUser.fotoPerfil = imageUrl;
        this.uploadingImage = false;
      } catch (error) {
        console.error('Error subiendo imagen:', error);
        alert('Error al subir la imagen');
        this.imagePreviewCreate = null;
        this.uploadingImage = false;
      }
    }
  }

  async createUser() {
    try {
      if (!this.newUser.nombre || !this.newUser.apellido || !this.newUser.email || !this.newUser.password) {
        alert('Por favor completa todos los campos requeridos');
        return;
      }

      // Crear el nuevo usuario (el admin mantiene su sesión)
      await this.authService.registerByAdmin(
        this.newUser.email,
        this.newUser.password,
        {
          nombre: this.newUser.nombre,
          apellido: this.newUser.apellido,
          rol: this.newUser.rol,
          fotoPerfil: this.newUser.fotoPerfil || null
        }
      );

      alert('Usuario creado exitosamente');
      this.closeCreateModal();

      // Recargar la lista de usuarios
      await this.loadUsers();
    } catch (error: any) {
      console.error('Error al crear usuario:', error);
      alert('Error al crear usuario: ' + (error.message || 'Error desconocido'));
    }
  }

  viewUser(user: UserModel) {
    this.selectedUser = { ...user };
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedUser = null;
  }

  editUserFromView() {
    this.showViewModal = false;
    this.showEditModal = true;
  }

  editUser(user: UserModel) {
    this.selectedUser = { ...user };
    this.imagePreviewEdit = user.fotoPerfil || null;
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.imagePreviewEdit = null;
    this.selectedUser = null;
  }

  async onImageSelectedEdit(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!this.cloudinaryService.isValidImageFile(file)) {
        return;
      }

      // Mostrar preview local
      this.imagePreviewEdit = this.cloudinaryService.createImagePreview(file);

      // Subir a Cloudinary
      try {
        this.uploadingImage = true;
        const imageUrl = await this.cloudinaryService.uploadImage(file);
        if (this.selectedUser) {
          this.selectedUser.fotoPerfil = imageUrl;
        }
        this.uploadingImage = false;
      } catch (error) {
        console.error('Error subiendo imagen:', error);
        alert('Error al subir la imagen');
        this.imagePreviewEdit = this.selectedUser?.fotoPerfil || null;
        this.uploadingImage = false;
      }
    }
  }

  async saveUser() {
    if (!this.selectedUser) return;

    try {
      await this.userService.updateUser(this.selectedUser.id, {
        nombre: this.selectedUser.nombre,
        apellido: this.selectedUser.apellido,
        email: this.selectedUser.email,
        rol: this.selectedUser.rol,
        fotoPerfil: this.selectedUser.fotoPerfil || null
      });
      this.closeEditModal();
      alert('Usuario actualizado correctamente');
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      alert('Error al actualizar usuario');
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  goToDashboard() {
    this.router.navigate(['/admin']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
