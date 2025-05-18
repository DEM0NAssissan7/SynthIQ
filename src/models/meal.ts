import Food from "./food";

export enum InsulinType {
  Regular,
  Novolog,
}
class Insulin {
  units: number;
  timestamp: Date;
  type: InsulinType;
  constructor(
    units: number,
    timestamp: Date,
    type: InsulinType = InsulinType.Regular
  ) {
    this.units = units;
    this.timestamp = timestamp;
    this.type = type;
  }
}
class Glucose {
  caps: number;
  constructor(caps: number) {
    this.caps = caps;
  }
}
class Meal {
  timestamp: Date;

  carbsOffset: number = 0;
  proteinOffset: number = 0;
  foods: Food[] = [];

  constructor(timestamp: Date) {
    // This timestamp marks when eating _begins_
    this.timestamp = timestamp;
  }
}

export default Meal;
