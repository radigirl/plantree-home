export type GroceryListStatus =
  | 'active'
  | 'completed'
  | 'archived';

export interface GroceryList {
  id: string;
  name: string;
  status: GroceryListStatus;
  is_pinned: boolean;
  created_by_member_id: number;
  created_at: string;
  updated_at: string;
}