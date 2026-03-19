export type GroceryListStatus =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'archived';

export interface GroceryList {
  id: string;
  name: string;
  status: GroceryListStatus;
  created_by_user_id: number;
  created_at: string;
}