namespace Unit {
  export enum Food {
    Unit = 1,
    Grams = 100,
  }

  export enum Glucose {
    MMOL = 1 / 18.018,
    MGDL = 1,
  }

  export enum Time {
    Second = 1,
    Millis = 1 / 1000,
    Minute = 60,
    Hour = 3600,
  }
}

export default Unit;
