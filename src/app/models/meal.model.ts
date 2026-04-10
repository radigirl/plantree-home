export interface Meal {
  id: string;
  name: string;
  prepTime?: number; // minutes
  ingredients?: string[];
  image_url?: string; // display URL
  image_path?: string; // row image path
  instructions?: string;   
}