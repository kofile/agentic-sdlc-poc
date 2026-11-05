export interface Customer {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
}
