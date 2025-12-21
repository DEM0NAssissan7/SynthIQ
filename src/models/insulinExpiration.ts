import { convertDimensions } from "../lib/util";
import { InsulinVariant } from "./types/insulinVariant";
import type { Deserializer, Serializer } from "./types/types";
import Unit from "./unit";

export class InsulinExpiration {
  constructor(
    public label: string,
    public variant: InsulinVariant,
    public openDate: Date
  ) {}
  get fullName(): string {
    return `${this.label} ${this.variant.name}`;
  }
  get endDate() {
    return new Date(
      this.openDate.getTime() +
        this.variant.daysLife *
          convertDimensions(Unit.Time.Day, Unit.Time.Millis)
    );
  }
  get daysLeft() {
    const now = new Date();
    console.log(this.openDate, this.endDate, now);
    return (
      (this.endDate.getTime() - now.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Day)
    );
  }
  get daysSinceOpened() {
    const now = new Date();
    return (
      (now.getTime() - this.openDate.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Day)
    );
  }
  static serialize: Serializer<InsulinExpiration> = (e: InsulinExpiration) => {
    return {
      label: e.label,
      variant: InsulinVariant.serialize(e.variant),
      openDate: e.openDate.getTime(),
    };
  };
  static deserialize: Deserializer<InsulinExpiration> = (o) => {
    return new InsulinExpiration(
      o.label,
      InsulinVariant.deserialize(o.variant),
      new Date(o.openDate)
    );
  };
}
