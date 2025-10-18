export interface Institution {
  id: string;
  name: string;
  type: string;
  workload_rules: {
    "15": number;
    "30": number;
    "45": number;
    "60": number;
    "75": number;
    "90": number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstitutionInsert {
  id?: string;
  name: string;
  type: string;
  workload_rules?: Institution['workload_rules'];
  is_active?: boolean;
}

export interface InstitutionUpdate {
  name?: string;
  type?: string;
  workload_rules?: Institution['workload_rules'];
  is_active?: boolean;
}
