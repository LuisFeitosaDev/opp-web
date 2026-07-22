import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/misc';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ListaDemandas from '@/pages/demandas/ListaDemandas';
import AdminUsuarios from '@/pages/admin/Usuarios';
import AdminPermissoes from '@/pages/admin/Permissoes';
import AdminParametros from '@/pages/admin/Parametros';
import AdminLogs from '@/pages/admin/Logs';

function Protegida({ tela, children }: { tela: string | null; children: React.ReactNode }) {
  const { session, usuario, carregando, podeVer } = useAuth();
  // sessão existente com perfil ainda carregando não pode redirecionar,
  // senão entra em loop com o redirect inverso da tela de login
  if (carregando || (session && !usuario)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-72 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (tela && !podeVer(tela)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-lg font-medium">Acesso negado</p>
        <p className="text-sm">Você não possui permissão para esta tela. Contate o administrador.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protegida tela={null}>
            <AppLayout />
          </Protegida>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/demandas" element={<Protegida tela="lista_demandas"><ListaDemandas /></Protegida>} />
        <Route path="/admin/usuarios" element={<Protegida tela="admin_usuarios"><AdminUsuarios /></Protegida>} />
        <Route path="/admin/permissoes" element={<Protegida tela="admin_permissoes"><AdminPermissoes /></Protegida>} />
        <Route path="/admin/parametros" element={<Protegida tela="admin_parametros"><AdminParametros /></Protegida>} />
        <Route path="/admin/logs" element={<Protegida tela="admin_logs"><AdminLogs /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
