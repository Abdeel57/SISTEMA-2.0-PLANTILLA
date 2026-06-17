import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Copy, Pencil, ShieldCheck, Store, Link2, KeyRound } from 'lucide-react';
import {
  createPanelUserSchema,
  STAFF_ROLE_LABELS,
  formatMXN,
  type PanelUserDTO,
  type CreatePanelUserInput,
  type UpdatePanelUserInput,
} from '@bismark/shared';
import { userService } from '@/services/users';
import { ApiError } from '@/lib/api';
import { buildSellerHomeUrl } from '@/lib/site';
import { copyToClipboard } from '@/lib/clipboard';
import { PanelIntro, PANEL_CARD } from '@/components/owner/PanelKit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PageLoader, EmptyState } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

function RoleBadge({ role }: { role: PanelUserDTO['role'] }) {
  if (role === 'SELLER') {
    return (
      <Badge variant="info">
        <Store className="h-3 w-3" /> Vendedor
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <ShieldCheck className="h-3 w-3" /> Administrador
    </Badge>
  );
}

// Métrica compacta (etiqueta + valor) para la cuadrícula de estadísticas.
function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border bg-background p-2.5 text-center">
      <p className={cn('text-lg font-extrabold leading-none tabular-nums', accent)}>{value}</p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function UserCard({ user, onEdit }: { user: PanelUserDTO; onEdit: (u: PanelUserDTO) => void }) {
  const queryClient = useQueryClient();
  const [confirmToggle, setConfirmToggle] = useState(false);

  const isActive = user.status === 'ACTIVE';
  const link = user.sellerCode ? buildSellerHomeUrl(user.sellerCode) : null;

  const toggleStatus = useMutation({
    mutationFn: () => userService.update(user.id, { status: isActive ? 'SUSPENDED' : 'ACTIVE' }),
    onSuccess: () => {
      setConfirmToggle(false);
      toast.success(isActive ? 'Usuario desactivado.' : 'Usuario activado.');
      void queryClient.invalidateQueries({ queryKey: ['panel-users'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  });

  const s = user.stats;

  return (
    <div className={cn(PANEL_CARD, 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-extrabold leading-tight">{user.name}</h3>
            {user.isOwner && <Badge variant="warning">Dueño</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <RoleBadge role={user.role} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={isActive ? 'success' : 'muted'}>{isActive ? 'Activo' : 'Inactivo'}</Badge>
        {user.sellerCode && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold">
            {user.sellerCode}
          </span>
        )}
      </div>

      {/* Link de venta del vendedor */}
      {link && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{link}</span>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => void copyToClipboard(link, 'Link copiado')}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
      )}

      {/* Métricas del vendedor */}
      {user.role === 'SELLER' && s && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Órdenes" value={s.ordersTotal.toLocaleString('es-MX')} />
          <Stat label="Boletos" value={s.ticketsSold.toLocaleString('es-MX')} />
          <Stat label="Vendido" value={formatMXN(s.revenue)} accent="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Pendientes" value={s.pendingOrders.toLocaleString('es-MX')} accent="text-amber-600 dark:text-amber-400" />
          <Stat label="Pagadas" value={s.paidOrders.toLocaleString('es-MX')} accent="text-blue-600 dark:text-blue-400" />
          <Stat label="Canceladas" value={s.cancelledOrders.toLocaleString('es-MX')} />
        </div>
      )}

      {/* Acciones */}
      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        {!user.isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className={isActive ? 'text-destructive hover:text-destructive' : 'text-emerald-600 hover:text-emerald-600'}
            onClick={() => setConfirmToggle(true)}
          >
            {isActive ? 'Desactivar' : 'Activar'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={isActive ? '¿Desactivar este usuario?' : '¿Activar este usuario?'}
        description={
          isActive ? (
            <>
              <span className="font-semibold">{user.name}</span> ya no podrá iniciar sesión hasta que lo vuelvas a
              activar. Sus ventas anteriores se conservan.
            </>
          ) : (
            <>
              <span className="font-semibold">{user.name}</span> podrá volver a iniciar sesión en el panel.
            </>
          )
        }
        confirmLabel={isActive ? 'Sí, desactivar' : 'Sí, activar'}
        destructive={isActive}
        loading={toggleStatus.isPending}
        onConfirm={() => toggleStatus.mutate()}
      />
    </div>
  );
}

// ── Modal de crear/editar usuario ───────────────────────────
type FormValues = CreatePanelUserInput;

function UserFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: PanelUserDTO | null;
}) {
  const queryClient = useQueryClient();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createPanelUserSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', role: 'SELLER', sellerCode: '' },
  });

  const role = watch('role');

  // Prellena el formulario al abrir: con los datos del usuario (editar) o en
  // blanco (crear). Va en efecto porque Radix no llama onOpenChange al abrir
  // de forma programática desde el padre.
  useEffect(() => {
    if (!open) return;
    setTempPassword(null);
    if (editing) {
      reset({
        name: editing.name,
        email: editing.email,
        phone: '',
        password: '',
        role: editing.role === 'SELLER' ? 'SELLER' : 'RIFERO',
        sellerCode: editing.sellerCode ?? '',
      });
    } else {
      reset({ name: '', email: '', phone: '', password: '', role: 'SELLER', sellerCode: '' });
    }
  }, [open, editing, reset]);

  const create = useMutation({
    mutationFn: (values: FormValues) => userService.create(values),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['panel-users'] });
      if (res.tempPassword) {
        setTempPassword(res.tempPassword);
        toast.success('Usuario creado. Comparte la contraseña temporal.');
      } else {
        toast.success('Usuario creado.');
        onOpenChange(false);
        reset();
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo crear el usuario'),
  });

  const update = useMutation({
    mutationFn: (values: FormValues) => {
      // Solo enviamos rol/código cuando cambian: así editar al dueño o la propia
      // cuenta (nombre/contraseña) no choca con las protecciones del backend.
      const payload: UpdatePanelUserInput = {
        name: values.name,
        phone: values.phone,
        password: values.password,
      };
      if (!editing!.isOwner && values.role !== editing!.role) payload.role = values.role;
      if (values.role === 'SELLER' && (values.sellerCode ?? '') !== (editing!.sellerCode ?? '')) {
        payload.sellerCode = values.sellerCode;
      }
      return userService.update(editing!.id, payload);
    },
    onSuccess: () => {
      toast.success('Usuario actualizado.');
      void queryClient.invalidateQueries({ queryKey: ['panel-users'] });
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  });

  // Cierre del modal (limpia la contraseña temporal mostrada).
  const onOpenChangeWrapped = (o: boolean) => {
    if (!o) setTempPassword(null);
    onOpenChange(o);
  };

  const submit = (values: FormValues) => {
    if (editing) update.mutate(values);
    else create.mutate(values);
  };

  const pending = create.isPending || update.isPending;
  const editingOwner = editing?.isOwner ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeWrapped}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Actualiza los datos, el rol o la contraseña de este usuario.'
              : 'Crea un administrador o un vendedor con su propio acceso al panel.'}
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          // Pantalla de éxito: contraseña temporal (se muestra una sola vez).
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Usuario creado. Comparte esta contraseña temporal (no se volverá a mostrar):
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-lg font-bold tracking-wide">
                  {tempPassword}
                </code>
                <Button variant="outline" size="sm" onClick={() => void copyToClipboard(tempPassword, 'Contraseña copiada')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="brand"
                onClick={() => {
                  onOpenChangeWrapped(false);
                  reset();
                }}
              >
                Entendido
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)} className="space-y-3.5">
            <div>
              <Label htmlFor="u-name">Nombre completo</Label>
              <Input id="u-name" {...register('name')} placeholder="Juan Pérez" />
              {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="u-email">Usuario o correo</Label>
              <Input
                id="u-email"
                {...register('email')}
                placeholder="juan@correo.com o juanventas"
                disabled={!!editing}
                autoComplete="off"
              />
              {editing && <p className="mt-1 text-xs text-muted-foreground">El usuario de acceso no se puede cambiar.</p>}
              {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="u-phone">Teléfono (opcional)</Label>
              <Input id="u-phone" {...register('phone')} placeholder="55 1234 5678" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="u-role">Rol</Label>
                <Select id="u-role" {...register('role')} disabled={editingOwner}>
                  <option value="SELLER">{STAFF_ROLE_LABELS.SELLER}</option>
                  <option value="RIFERO">{STAFF_ROLE_LABELS.RIFERO}</option>
                </Select>
              </div>
              {role === 'SELLER' && (
                <div>
                  <Label htmlFor="u-code">Código (opcional)</Label>
                  <Input id="u-code" {...register('sellerCode')} placeholder="VEN01" className="font-mono uppercase" />
                </div>
              )}
            </div>
            {role === 'SELLER' && (
              <p className="-mt-1 text-xs text-muted-foreground">
                Si lo dejas vacío se genera automáticamente (VEN01, VEN02…).
              </p>
            )}

            <div>
              <Label htmlFor="u-pass" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                {editing ? 'Nueva contraseña (opcional)' : 'Contraseña (opcional)'}
              </Label>
              <Input id="u-pass" type="text" {...register('password')} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              <p className="mt-1 text-xs text-muted-foreground">
                {editing
                  ? 'Déjala vacía para no cambiarla.'
                  : 'Déjala vacía y el sistema generará una contraseña temporal.'}
              </p>
              {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChangeWrapped(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" loading={pending}>
                {editing ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PanelUserDTO | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['panel-users'],
    queryFn: () => userService.list(),
  });
  const users = data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u: PanelUserDTO) => {
    setEditing(u);
    setFormOpen(true);
  };

  return (
    <div>
      <PanelIntro
        description="Da acceso al panel a administradores y vendedores. Cada vendedor tiene su propio link de venta."
        action={
          <Button variant="brand" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo usuario
          </Button>
        }
      />

      {isLoading ? (
        <PageLoader label="Cargando usuarios..." />
      ) : isError ? (
        <EmptyState
          title="No pudimos cargar los usuarios"
          description={error instanceof ApiError ? error.message : 'Intenta de nuevo.'}
        />
      ) : users.length === 0 ? (
        <EmptyState
          title="Aún no hay usuarios"
          description="Crea tu primer vendedor para empezar a repartir links de venta."
          action={
            <Button variant="brand" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Crear usuario
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {users.map((u) => (
            <UserCard key={u.id} user={u} onEdit={openEdit} />
          ))}
        </div>
      )}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
}
