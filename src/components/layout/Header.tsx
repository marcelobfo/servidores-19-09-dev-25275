import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { LogOut, User, GraduationCap, Shield, Moon, Sun, Menu } from "lucide-react";
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
        <nav className="hidden md:flex items-center space-x-4">
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
              <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                Olá, {user.email}
              </span>
              {isAdmin ? (
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger className="flex items-center space-x-2">
                        <Shield className="h-4 w-4" />
                        <span>Admin</span>
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid gap-3 p-6 w-[400px]">
                          <div className="row-span-3">
                            <NavigationMenuLink asChild>
                              <Link
                                className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                                to="/admin"
                              >
                                <div className="mb-2 mt-4 text-lg font-medium">
                                  Painel Administrativo
                                </div>
                                <p className="text-sm leading-tight text-muted-foreground">
                                  Gerencie áreas, cursos, inscrições e configurações do sistema.
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          </div>
                          <div className="grid gap-2">
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/areas"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="text-sm font-medium leading-none">Áreas</div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  Gerenciar áreas de conhecimento
                                </p>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/courses"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="text-sm font-medium leading-none">Cursos</div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  Criar e editar cursos
                                </p>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/enrollments"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="text-sm font-medium leading-none">Inscrições</div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  Gerenciar inscrições de estudantes
                                </p>
                              </Link>
                            </NavigationMenuLink>
                            <NavigationMenuLink asChild>
                              <Link
                                to="/admin/certificates"
                                className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="text-sm font-medium leading-none">Certificados</div>
                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                  Gerenciar certificados emitidos
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          </div>
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/student")}
                  className="flex items-center space-x-2"
                >
                  <User className="h-4 w-4" />
                  <span>Minha Área</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </Button>
            </>
          ) : (
            <>
              <Link to="/courses">
                <Button variant="ghost" size="sm">
                  Cursos
                </Button>
              </Link>
              <Link to="/verify-certificate">
                <Button variant="ghost" size="sm">
                  Verificar Certificado
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm">Entrar</Button>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center space-x-2">
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

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 px-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col space-y-4">
                {user ? (
                  <>
                    <div className="pb-4 border-b">
                      <p className="text-sm text-muted-foreground mb-1">Conectado como:</p>
                      <p className="text-sm font-medium truncate">{user.email}</p>
                    </div>
                    
                    {isAdmin ? (
                      <>
                        <Link to="/admin" className="w-full">
                          <Button variant="outline" className="w-full justify-start">
                            <Shield className="mr-2 h-4 w-4" />
                            Painel Admin
                          </Button>
                        </Link>
                        <Link to="/admin/areas" className="w-full">
                          <Button variant="ghost" className="w-full justify-start">
                            Áreas
                          </Button>
                        </Link>
                        <Link to="/admin/courses" className="w-full">
                          <Button variant="ghost" className="w-full justify-start">
                            Cursos
                          </Button>
                        </Link>
                        <Link to="/admin/enrollments" className="w-full">
                          <Button variant="ghost" className="w-full justify-start">
                            Inscrições
                          </Button>
                        </Link>
                        <Link to="/admin/certificates" className="w-full">
                          <Button variant="ghost" className="w-full justify-start">
                            Certificados
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link to="/student" className="w-full">
                        <Button variant="outline" className="w-full justify-start">
                          <User className="mr-2 h-4 w-4" />
                          Minha Área
                        </Button>
                      </Link>
                    )}
                    
                    <Button
                      variant="destructive"
                      onClick={handleSignOut}
                      className="w-full justify-start"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/courses" className="w-full">
                      <Button variant="outline" className="w-full justify-start">
                        Cursos
                      </Button>
                    </Link>
                    <Link to="/verify-certificate" className="w-full">
                      <Button variant="outline" className="w-full justify-start">
                        Verificar Certificado
                      </Button>
                    </Link>
                    <Link to="/auth" className="w-full">
                      <Button className="w-full">Entrar</Button>
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};