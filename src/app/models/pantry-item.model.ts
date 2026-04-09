export interface PantryItem {
  id: string;
  name: string;
  normalized_name: string;
  amount: number;
  unit: 'item' | 'measured';
  size_amount: number | null;
  size_unit: string | null;
  created_at: string;
  updated_at: string;
  expiry_date: string | null;
}