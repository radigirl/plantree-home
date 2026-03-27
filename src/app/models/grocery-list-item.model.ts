import { FamilyMember } from "./family-member.model";

export type GroceryItemStatus =
  | 'needed'
  | 'bought'
  | 'skipped';

export interface GroceryListItem {
  id: string;
  grocery_list_id: string;
  name: string;
  status: GroceryItemStatus;
  added_by_user_id: number;
  created_at: string;
  addedBy?: FamilyMember;
  moved_to_pantry: boolean;
}