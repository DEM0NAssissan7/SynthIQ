import type { Deserializer, Serializer } from "./types";

export class RescueVariant {
    constructor(
        public name: string,
        public duration: number,
        public effect: number
    ) { }

    static serialize: Serializer<RescueVariant> = (i: RescueVariant) => {
        return {
            name: i.name,
            duration: i.duration,
            effect: i.effect,
        };
    };
    static deserialize: Deserializer<RescueVariant> = (o) => {
        return new RescueVariant(o.name, o.duration, o.effect);
    };
}
