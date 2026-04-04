export interface Meal {
  id: string;
  name: string;

  prepTime?: number;        // minutes
  ingredients?: string[];
  image_url?: string;
  instructions?: string;   
}