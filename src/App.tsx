import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CoursesPage from "./pages/CoursesPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import PreEnrollmentPage from "./pages/PreEnrollmentPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CoursesPageAdmin from "./pages/admin/CoursesPage";
import AreasPage from "./pages/admin/AreasPage";
import AdminEnrollmentsPage from "./pages/admin/EnrollmentsPage";
import SystemSettingsPage from "./pages/admin/SystemSettings";
import PaymentSettingsPage from "./pages/admin/PaymentSettingsPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import ProfilePage from "./pages/student/ProfilePage";
import { PreEnrollmentsPage } from "./pages/student/PreEnrollmentsPage";
import { EnrollmentsPage as StudentEnrollmentsPage } from "./pages/student/EnrollmentsPage";
import { CertificatesPage as StudentCertificatesPage } from "./pages/student/CertificatesPage";
import { DocumentsPage } from "./pages/student/DocumentsPage";
import { StudentLayout } from "./components/layout/StudentLayout";
import NotFound from "./pages/NotFound";
import VerifyCertificate from "./pages/VerifyCertificate";
import CertificatesPage from "./pages/admin/CertificatesPage";
import EnrollmentsManagementPage from "./pages/admin/EnrollmentsManagementPage";
import UsersManagementPage from "./pages/admin/UsersManagementPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <CookieConsent />
          <BrowserRouter>
            <Routes>
              {/* Public routes with header and footer */}
              <Route path="/" element={
                <div className="min-h-screen bg-background flex flex-col">
                  <Header />
                  <main className="flex-1">
                    <Index />
                  </main>
                  <Footer />
                </div>
              } />
              <Route path="/auth" element={
                <div className="min-h-screen bg-background flex flex-col">
                  <Header />
                  <main className="flex-1 container mx-auto px-4 py-8">
                    <Auth />
                  </main>
                  <Footer />
                </div>
              } />
              <Route path="/courses" element={
                <div className="min-h-screen bg-background flex flex-col">
                  <Header />
                  <main className="flex-1 container mx-auto px-4 py-8">
                    <CoursesPage />
                  </main>
                  <Footer />
                </div>
              } />
              <Route path="/course/:slug" element={
                <div className="min-h-screen bg-background flex flex-col">
                  <Header />
                  <main className="flex-1 container mx-auto px-4 py-8">
                    <CourseDetailPage />
                  </main>
                  <Footer />
                </div>
              } />
              <Route path="/verify-certificate/:code?" element={
                <div className="min-h-screen bg-background flex flex-col">
                  <Header />
                  <main className="flex-1 container mx-auto px-4 py-8">
                    <VerifyCertificate />
                  </main>
                  <Footer />
                </div>
              } />
              
              {/* Legal pages */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-use" element={<TermsOfUse />} />
              <Route 
                path="/pre-enrollment" 
                element={
                  <AuthGuard>
                    <div className="min-h-screen bg-background">
                      <Header />
                      <main className="container mx-auto px-4 py-8">
                        <PreEnrollmentPage />
                      </main>
                    </div>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/student/*" 
                element={
                  <AuthGuard>
                    <StudentLayout>
                      <Routes>
                        <Route index element={<Navigate to="/student/pre-enrollments" replace />} />
                        <Route path="pre-enrollments" element={<PreEnrollmentsPage />} />
                        <Route path="enrollments" element={<StudentEnrollmentsPage />} />
                        <Route path="certificates" element={<StudentCertificatesPage />} />
                        <Route path="documents" element={<DocumentsPage />} />
                        <Route path="profile" element={<ProfilePage />} />
                      </Routes>
                    </StudentLayout>
                  </AuthGuard>
                } 
              />

              {/* Admin routes with sidebar */}
              <Route 
                path="/admin" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <AdminDashboard />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/courses" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <CoursesPageAdmin />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/areas" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <AreasPage />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/enrollments" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <AdminEnrollmentsPage />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/certificates"
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <CertificatesPage />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/settings" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <SystemSettingsPage />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/payment-settings" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <PaymentSettingsPage />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/matriculas" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <EnrollmentsManagementPage />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />
              <Route 
                path="/admin/users" 
                element={
                  <AuthGuard adminOnly>
                    <AdminLayout>
                      <UsersManagementPage />
                    </AdminLayout>
                  </AuthGuard>
                } 
              />

              {/* 404 route */}
              <Route path="*" element={
                <div className="min-h-screen bg-background flex flex-col">
                  <Header />
                  <main className="flex-1 container mx-auto px-4 py-8">
                    <NotFound />
                  </main>
                  <Footer />
                </div>
              } />
            </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </ThemeProvider>
  </QueryClientProvider>
);

export default App;
