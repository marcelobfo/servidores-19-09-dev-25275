import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { LogOut, User, GraduationCap, Shield, Moon, Sun, Menu, LayoutDashboard, MapPin, BookOpen, Users, Award, Settings } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo - Responsivo */}
        <Link to="/" className="flex items-center space-x-2">
          <GraduationCap className="h-6 w-6 flex-shrink-0" />
          <span className="font-bold text-lg md:text-xl truncate max-w-[140px] sm:max-w-none">
            Sistema de Matrícula
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-4">
          {/* Public links */}
          <Link to="/courses">
            <Button variant="ghost" size="sm">Cursos</Button>
          </Link>
          <Link to="/verify-certificate">
            <Button variant="ghost" size="sm" className="hidden lg:flex">
              Verificar Certificado
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9 px-0"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {user ? (
              <>
                {/* Admin Menu - Compact */}
                {isAdmin && (
                  <NavigationMenu>
                    <NavigationMenuList>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger className="h-9">
                          <Shield className="h-4 w-4 mr-1" />
                          Admin
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="grid gap-2 p-4 w-[280px]">
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin"
                                className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
                              >
                                <LayoutDashboard className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="text-sm font-medium">Dashboard</div>
                                  <p className="text-xs text-muted-foreground">Visão geral</p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/areas"
                                className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
                              >
                                <MapPin className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="text-sm font-medium">Áreas</div>
                                  <p className="text-xs text-muted-foreground">Gerenciar áreas</p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/courses"
                                className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
                              >
                                <BookOpen className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="text-sm font-medium">Cursos</div>
                                  <p className="text-xs text-muted-foreground">Gerenciar cursos</p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/enrollments"
                                className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
                              >
                                <Users className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="text-sm font-medium">Inscrições</div>
                                  <p className="text-xs text-muted-foreground">Gerenciar alunos</p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/certificates"
                                className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
                              >
                                <Award className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="text-sm font-medium">Certificados</div>
                                  <p className="text-xs text-muted-foreground">Gerenciar certificados</p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/system-settings"
                                className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
                              >
                                <Settings className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="text-sm font-medium">Configurações</div>
                                  <p className="text-xs text-muted-foreground">Sistema</p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                    </NavigationMenuList>
                  </NavigationMenu>
                )}
                
                {/* User menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full">
                      <User className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="truncate max-w-[200px]">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate(isAdmin ? "/admin" : "/student")}>
                      <User className="h-4 w-4 mr-2" />
                      Minha Área
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/auth?tab=signup">
                  <Button variant="outline" size="sm">Cadastrar</Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm">Entrar</Button>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="sm" className="h-9 w-9 px-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col space-y-4 mt-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="justify-start"
              >
                <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 ml-1 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="ml-6">Alternar Tema</span>
              </Button>

              {user ? (
                <>
                  <div className="px-4 py-2 text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  
                  {isAdmin && (
                    <div className="space-y-2">
                      <div className="px-4 py-2 text-sm font-semibold flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Área Administrativa
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigate("/admin");
                        }}
                        className="w-full justify-start"
                      >
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Dashboard
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/admin/areas")}
                        className="w-full justify-start"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Áreas
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/admin/courses")}
                        className="w-full justify-start"
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        Cursos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/admin/enrollments")}
                        className="w-full justify-start"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Inscrições
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/admin/certificates")}
                        className="w-full justify-start"
                      >
                        <Award className="h-4 w-4 mr-2" />
                        Certificados
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/admin/system-settings")}
                        className="w-full justify-start"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configurações
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(isAdmin ? "/admin" : "/student")}
                    className="justify-start"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Minha Área
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/courses")}
                    className="justify-start"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Cursos
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/verify-certificate")}
                    className="justify-start"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    Verificar Certificado
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="justify-start text-destructive"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/courses")}
                    className="justify-start"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Cursos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/verify-certificate")}
                    className="justify-start"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    Verificar Certificado
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/auth?tab=signup")}
                    size="sm"
                    className="justify-start"
                  >
                    Cadastrar
                  </Button>
                  <Button
                    onClick={() => navigate("/auth")}
                    size="sm"
                    className="justify-start"
                  >
                    Entrar
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
