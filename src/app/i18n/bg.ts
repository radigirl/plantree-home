export const bg = {
  common: {
    and: 'и',
    cancel: 'Отказ',
    add: 'Добави',
    addTo: 'Добави към',
    day: 'ден',
    days: 'дни',
    remove: 'Премахни',
    today: 'Днес',
    tomorrow: 'Утре',
    pickDate: 'Избери дата',
    show: 'Покажи',
    hide: 'Скрий',
    undo: 'Отмени',
  },
  menu: {
    member: 'Член',
    changeMember: 'Смени член',
    cookFromPantry: 'Готви с наличното',
    myMeals: 'Моите ястия',
    weekStats: 'Седмична статистика',
    notifications: 'Известия',
    language: 'Език',
    settings: 'Настройки',
    about: 'Относно',
    logout: 'Изход',
    addMember: '+ Добави член',
    currentMember: 'Активен член',
    manageMembers: 'Управление на членове',
    manageSpaces: 'Управление на места',
    manageMeals: 'Управление на ястия',
    account: 'Акаунт',
    editProfile: 'Редактирай профил',
    deleteAccount: 'Изтрий акаунт',
  },

  nav: {
    home: 'Начало',
    plan: 'План',
    lists: 'Списъци',
    pantry: 'Продукти',
  },

  home: {
    cookFromPantry: 'Готви с наличното →',
    findNextMeal: 'Намери следващото си ястие',

    whatsForToday: 'Какво ще готвим днес?',
    noMealPlanned: 'Няма планирани ястия',
    cookLabel: 'Готвач:',
    unassigned: 'Не е избран',

    weekPlan: 'Седмичен план',
    plannedOne: 'планирано',
    plannedMany: 'планирани',
    dayRemainingOne: 'ден остава',
    dayRemainingMany: 'дни остават',

    myMeals: 'Моите ястия',
    lastAdded: 'Последно добавено:',
    noSavedMeals: 'Няма запазени ястия',

    lists: 'Списъци',
    activeListOne: 'активен списък',
    activeListMany: 'активни списъка',
    latest: 'Последен:',

    weekStats: 'Седмична статистика',
    chefOfTheWeek: 'Готвач на седмицата:',
    topCooks: 'Топ готвачи:',
    noMealsCooked: 'Няма сготвени ястия',
    mealPlaceholderAlt: 'Празно ястие',
    mealImageAlt: 'Снимка на ястие',
    cookAvatarAlt: 'Аватар на готвач',
    moreMealsPrefix: '+ още',
    mealOne: 'ястие',
    mealMany: 'ястия',
  },

  mealStatus: {
    'to-prepare': 'Предстои',
    'in-progress': 'Готви се',
    'ready-to-serve': 'Готово',
  },
  plan: {
    previousWeek: 'Предишна седмица',
    nextWeek: 'Следваща седмица',
    pickDate: 'Избери дата',
    today: 'Днес',
  },
  daysShort: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  daysShortMondayFirst: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],

  monthsLong: [
    'Януари',
    'Февруари',
    'Март',
    'Април',
    'Май',
    'Юни',
    'Юли',
    'Август',
    'Септември',
    'Октомври',
    'Ноември',
    'Декември',
  ],
  meals: {
    title: 'Моите ястия',
    subtitle: 'Създавай, организирай, планирай',

    searchPlaceholder: 'Търси ястия...',
    noResults: 'Няма намерени ястия',
    empty: 'Все още няма добавени ястия',

    actions: 'Действия',

    edit: 'Редактирай',
    createFromThis: 'Използвай като основа',
    addToPlan: 'Добави към плана',
    remove: 'Премахни',

    removeTitle: 'Премахване на ястие',
    removeMessage: 'Да премахна ли „{{name}}“ от Моите ястия? Все още ще можеш да го достъпваш чрез други членове или минали планове.',

    ingredient: 'съставка',
    ingredients: 'съставки',

    singleDay: 'Един ден',
    multipleDays: 'Няколко дни',

    addToPlanWithName: 'Добави „{{name}}“ към плана',
    addedToDayToast: '„{{name}}“ е добавено за {{day}}',
    addedToMultipleDaysToast: '„{{name}}“ е добавено към {{count}} дни',
    failedToAdd: 'Неуспешно добавяне на ястие',
    removedToast: '„{{name}}“ е премахнато от Моите ястия',
    updatedToast: '„{{name}}“ е редактирано',
    savedToast: '„{{name}}“ е запазено в Моите ястия',
    meal: 'ястие',
    meals: 'ястия',
    untitledMeal: 'Ястие без име',
  },
  daysLong: ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'],
  mealDialog: {
    createTitle: 'Създай ястие',
    editTitle: 'Редактирай ястие',

    mealName: 'Име на ястието',
    mealNamePlaceholder: 'Въведи име на ястие',

    prepTime: 'Време за приготвяне (минути)',
    optional: 'Незадължително',

    ingredients: 'Съставки',
    ingredientsHelper: 'По една на ред или разделени със запетая',
    ingredientsExample: 'напр.: 2 яйца, 200 гр. сирене, 1 лук, 1/2 чаша мляко',
    quantityTip: 'Съвет: първо количеството',
    ingredientsPlaceholder: 'Добави съставки',

    instructions: 'Инструкции',
    instructionsPlaceholder: 'напр.: сварете пастата, пригответе соса, смесете и сервирайте.',

    mealPhoto: 'Снимка на ястие',
    previewAlt: 'Преглед на ястие',
    chooseFile: 'Избери файл',
    noFileChosen: 'Няма избран файл',

    save: 'Запази',
    update: 'Запази промените',
    saving: 'Запазване...',
  },
  mealDetails: {
    close: 'Затвори детайлите за ястието',
    noDetails: 'Няма добавени детайли',
    noIngredients: 'Няма добавени съставки',
    noInstructions: 'Няма добавени инструкции',
  },
  generateSheet: {
    title: 'Генерирай списък',
    subtitle: 'Създай списък от ястията за тази седмица',

    allCovered: 'Всички предстоящи ястия вече са добавени в списъци',
    generateUpcoming: 'Генерирай от предстоящите ястия',
    tapToReviewCoverage: 'Докосни по-долу, за да видиш кои ястия в кои списъци са',

    alreadyCoveredSkipped: 'вече са добавени в списъци и ще бъдат пропуснати',

    reviewCoverage: 'Прегледай включените ястия',
    adjustSelection: 'Редактирай избора',

    selectDays: 'Избери дни',
    inList: 'В:',

    allMealsAlreadyCovered: 'Всички ястия вече са добавени в списъци',

    createList: 'Създай списък',

    noMealsPlanned: 'Няма планирани ястия тази седмица',
    addMealsToGenerate: 'Добави ястия, за да генерираш списък',

    planListName: 'Списък от плана',
    creatingList: 'Създаване на списък...',
    createListFailed: 'Списъкът не беше създаден',
    listCreated: 'Списъкът е създаден',
  }
};