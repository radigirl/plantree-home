import { Member } from "./member.model";

export type GroceryItemStatus =
  | 'needed'
  | 'bought'
  | 'skipped';

export interface GroceryListItem {
  id: string;
  grocery_list_id: string;
  name: string;
  status: GroceryItemStatus;
  added_by_member_id: number;
  created_at: string;
  addedBy?: Member;
  moved_to_pantry: boolean;
}