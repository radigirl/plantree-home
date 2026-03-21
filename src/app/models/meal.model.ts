export interface Meal {
  id: string;
  name: string;

  prepTime?: number;        // minutes
  ingredients?: string[];
  image?: string;
  instructions?: string;     
}