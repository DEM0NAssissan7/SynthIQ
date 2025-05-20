namespace Unit {
  export enum Food {
    Unit = 1,
    HundredGrams = 100,
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

export function getFoodUnitPrettyName(unit: Unit.Food): string {
  switch (unit) {
    case Unit.Food.Unit:
      return "u";
    case Unit.Food.HundredGrams:
      return "100g";
  }
}

export function getTimeUnitPrettyName(unit: Unit.Time): string {
  switch (unit) {
    case Unit.Time.Second:
      return "seconds";
    case Unit.Time.Millis:
      return "milliseconds";
    case Unit.Time.Minute:
      return "minutes";
    case Unit.Time.Hour:
      return "hours";
  }
}
