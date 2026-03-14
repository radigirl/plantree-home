import { DayPlan } from '../models/day-plan.model';

export const WEEK_PLAN_MOCK: DayPlan[] = [
  {
    day: 'Mon',
    date: 1,
    meals: [
      {
        id: 'planned-1',
        meal: {
          id: 'meal-1',
          name: 'Pasta',
          prepTime: 20,
          ingredients: ['Pasta', 'Tomato sauce', 'Parmesan'],
          image: 'assets/meals/pasta.jpg',
        },
        cook: {
          id: 'member-1',
          name: 'Dad',
          avatar: 'assets/avatars/dad.png',
        },
        status: 'to-prepare',
      },
      {
        id: 'planned-2',
        meal: {
          id: 'meal-2',
          name: 'Salad',
          prepTime: 10,
          ingredients: ['Lettuce', 'Tomato', 'Cucumber'],
          image: 'assets/meals/salad.jpg',
        },
        cook: {
          id: 'member-2',
          name: 'Mom',
          avatar: 'assets/avatars/mom.png',
        },
        status: 'ready-to-serve',
      },
    ],
  },

  {
    day: 'Tue',
    date: 2,
    meals: [
      {
        id: 'planned-3',
        meal: {
          id: 'meal-3',
          name: 'Tacos',
          prepTime: 15,
          ingredients: ['Tortillas', 'Beef', 'Lettuce', 'Cheese'],
          image: 'assets/meals/tacos.jpg',
        },
        cook: {
          id: 'member-2',
          name: 'Mom',
          avatar: 'assets/avatars/mom.png',
        },
        status: 'ready-to-serve',
      },
    ],
  },

  {
    day: 'Wed',
    date: 3,
    meals: [
      {
        id: 'planned-4',
        meal: {
          id: 'meal-4',
          name: 'Stir Fry',
          prepTime: 25,
          ingredients: ['Chicken', 'Garlic', 'Broccoli', 'Rice'],
          image: 'assets/meals/stir-fry.jpg',
        },
        cook: {
          id: 'member-3',
          name: 'Yasen',
          avatar: 'assets/avatars/yasen.png',
        },
        status: 'in-progress',
      },
    ],
  },

  {
    day: 'Thu',
    date: 4,
    meals: [
      {
        id: 'planned-5',
        meal: {
          id: 'meal-5',
          name: 'Pizza',
          prepTime: 30,
          ingredients: ['Pizza dough', 'Tomato sauce', 'Mozzarella'],
          image: 'assets/meals/pizza.jpg',
        },
        cook: {
          id: 'member-1',
          name: 'Dad',
          avatar: 'assets/avatars/dad.png',
        },
        status: 'to-prepare',
      },
    ],
  },

  {
    day: 'Fri',
    date: 5,
    meals: [
      {
        id: 'planned-6',
        meal: {
          id: 'meal-6',
          name: 'Omelette',
          prepTime: 12,
          ingredients: ['Eggs', 'Cheese', 'Butter'],
          image: 'assets/meals/omelette.jpg',
        },
        cook: {
          id: 'member-2',
          name: 'Mom',
          avatar: 'assets/avatars/mom.png',
        },
        status: 'in-progress',
      },
      {
        id: 'planned-7',
        meal: {
          id: 'meal-7',
          name: 'Stuffed Peppers',
          prepTime: 40,
          ingredients: ['Peppers', 'Rice', 'Minced meat', 'Tomato sauce'],
          image: 'assets/meals/stuffed-peppers.jpg',
        },
        cook: {
          id: 'member-1',
          name: 'Dad',
          avatar: 'assets/avatars/dad.png',
        },
        status: 'to-prepare',
      },
    ],
  },

  {
    day: 'Sat',
    date: 6,
    meals: [],
  },

  {
    day: 'Sun',
    date: 7,
    meals: [],
  },
];
