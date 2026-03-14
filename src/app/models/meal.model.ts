export interface Meal {
  id: string;
  name: string;

  prepTime?: number;        // minutes
  ingredients?: string[];   // ingredient names
  image?: string;           // meal picture URL
}