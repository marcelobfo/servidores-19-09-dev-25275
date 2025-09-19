// Extended profile types to include new fields
export interface ExtendedProfile {
  created_at: string;
  email: string | null;
  full_name: string | null;
  id: string;
  role: "admin" | "student";
  updated_at: string;
  user_id: string;
  whatsapp: string | null;
  // New fields
  cpf?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  address?: string | null;
  address_number?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}