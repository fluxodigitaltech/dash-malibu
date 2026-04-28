import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  MenuIcon,
  HomeIcon,
  SettingsIcon,
  LogOutIcon,
  MessageCircleMore,
  Send,
  BarChart2,
  PanelLeftOpen,
  PanelLeftClose,
  Bell,
  User,
  CreditCard,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const DashboardLayout = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const userName = String(user?.user_metadata?.name || 'Usuário');
  const userEmail = user?.email || '';

  const getInitials = () => {
    if (typeof userName !== 'string') return 'U';
    const nameParts = userName.split(' ');
    if (nameParts.length > 1) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    return nameParts[0]?.[0]?.toUpperCase() || 'U';
  };

  const navItems = [
    { to: '/overview', icon: HomeIcon, label: 'Visão Geral' },
    { to: '/dashboard', icon: BarChart2, label: 'Dashboard' },
    { to: '/pacto-operations', icon: CreditCard, label: 'Operações Pacto' },
    { to: '/whatsapp', icon: MessageCircleMore, label: 'WhatsApp' },
    { to: '/message-sender', icon: Send, label: 'Disparador' },
    { to: '/settings', icon: SettingsIcon, label: 'Configurações' },
    ...(isAdmin ? [{ to: '/users', icon: Users, label: 'Usuários' }] : []),
  ];

  const NavLink = ({ to, icon: Icon, label, currentLocation }: {
    to: string;
    icon: React.ElementType;
    label: string;
    currentLocation: { pathname: string };
  }) => {
    const isActive = currentLocation.pathname === to;

    return (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-300 group relative",
          isActive
            ? "bg-primary/10 text-primary shadow-[0_0_20px_rgba(124,93,250,0.1)] font-bold border border-primary/20"
            : "text-muted-foreground/60 hover:bg-white/5 hover:text-white",
          "touch-none"
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_10px_rgba(124,93,250,0.8)]" />
        )}
        <div className="relative flex items-center justify-center h-6 w-6">
          <Icon className={cn("h-5 w-5 transition-all duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
        </div>
        <span className="font-semibold tracking-wide text-sm">{label}</span>
      </Link>
    );
  };

  return (
    <div className="h-screen w-full bg-[#0e0d15] flex overflow-hidden">
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transition-all duration-500 ease-in-out",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isMobile ? "w-72" : "w-64"
      )}>
        <div className="h-full w-full bg-[#11111a]/80 backdrop-blur-3xl border-r border-white/5 shadow-2xl flex flex-col">
          <div className="flex h-20 items-center px-8">
            <Link to="/overview" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/40 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                <img
                  src="https://framerusercontent.com/images/hGJyQWRHAsnDQLAGF0vGRbNIkb0.png?scale-down-to=512"
                  alt="Logo"
                  className="h-10 w-auto relative z-10 drop-shadow-2xl"
                />
              </div>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-10 px-4 space-y-6 scrollbar-hide">
            <div className="px-4 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">Principal</div>
            <div className="space-y-2">
              {navItems.slice(0, 2).map((item) => (
                <NavLink key={item.to} {...item} currentLocation={location} />
              ))}
            </div>

            <div className="px-4 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-8 mb-4">Comunicação</div>
            <div className="space-y-2">
              {navItems.slice(2, 5).map((item) => (
                <NavLink key={item.to} {...item} currentLocation={location} />
              ))}
            </div>

            <div className="px-4 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-8 mb-4">Sistema</div>
            <div className="space-y-2">
              {navItems.slice(5).map((item) => (
                <NavLink key={item.to} {...item} currentLocation={location} />
              ))}
            </div>
          </nav>

          <div className="p-6">
            <div className="p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all group">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-primary/30 premium-shadow">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ''} alt={userName} />
                  <AvatarFallback className="bg-primary text-white font-black text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-xs truncate group-hover:text-primary transition-colors">{userName}</p>
                  <p className="text-[10px] text-muted-foreground/50 truncate font-semibold uppercase tracking-wider">Premium Plan</p>
                </div>
              </div>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full mt-4 h-9 rounded-xl bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20">
                <LogOutIcon className="h-3.5 w-3.5 mr-2" /> Sair da Conta
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className={cn("flex-1 transition-all duration-300 ease-in-out h-full overflow-hidden flex flex-col", isSidebarOpen && !isMobile ? "ml-64" : "ml-0")}>
        <header className="sticky top-0 z-40 h-20 bg-[#0e0d15]/60 backdrop-blur-xl border-b border-white/5">
          <div className="flex h-full items-center justify-between px-10">
            <div className="flex items-center gap-6">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground/60 hover:text-white">
                    <MenuIcon className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0 bg-[#0e0d15] border-r border-white/5">
                  {/* Reuse sidebar content if needed or keep it simple */}
                  <div className="h-full flex flex-col p-6">
                     <Link to="/overview" className="mb-10"><img src="https://framerusercontent.com/images/hGJyQWRHAsnDQLAGF0vGRbNIkb0.png?scale-down-to=512" alt="Logo" className="h-8 w-auto" /></Link>
                     {/* ... mobile nav ... */}
                  </div>
                </SheetContent>
              </Sheet>
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden md:flex text-muted-foreground/40 hover:text-white transition-all">
                {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
              </Button>
              <div className="h-6 w-px bg-white/5 hidden md:block" />
              <h2 className="text-sm font-bold text-white/40 uppercase tracking-[0.2em] hidden lg:block">Dashboard System</h2>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center bg-white/5 rounded-2xl px-3 py-1.5 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">System Live</span>
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground/60 hover:text-white relative">
                <Bell className="h-5 w-5" />
                <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-[#0e0d15]" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-auto p-1 rounded-2xl hover:bg-white/5 transition-all">
                    <Avatar className="h-10 w-10 border border-white/10 premium-shadow">
                      <AvatarImage src={user?.user_metadata?.avatar_url || ''} alt={userName} />
                      <AvatarFallback className="bg-primary text-white text-xs font-black">{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-[#11111a] border-white/5 p-2 rounded-2xl premium-shadow" align="end">
                  <DropdownMenuLabel className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-white">{userName}</span>
                      <span className="text-[10px] text-muted-foreground/50 font-semibold truncate uppercase tracking-wider">{userEmail}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5 mx-2" />
                  <div className="p-1">
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer rounded-xl h-10 hover:bg-white/5 focus:bg-white/5 transition-all text-sm font-semibold">
                      <User className="mr-3 h-4 w-4 text-primary" /><span>Meu Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer rounded-xl h-10 hover:bg-white/5 focus:bg-white/5 transition-all text-sm font-semibold">
                      <SettingsIcon className="mr-3 h-4 w-4 text-primary" /><span>Configurações</span>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator className="bg-white/5 mx-2" />
                  <div className="p-1">
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer rounded-xl h-10 hover:bg-red-500/10 focus:bg-red-500/10 transition-all text-red-400 text-sm font-bold">
                      <LogOutIcon className="mr-3 h-4 w-4" /><span>Sair da Conta</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-[#0e0d15] custom-scrollbar"><Outlet /></main>
      </div>
      {isSidebarOpen && isMobile && (<div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />)}
    </div>
  );
};

export default DashboardLayout;