import { InsulinVariant } from "../models/types/insulinVariant";
import { InsulinVariantStore } from "../storage/insulinVariantStore";

export namespace InsulinVariantManager {
  export function getDefault() {
    return InsulinVariantStore.variants.value[0];
  }
  function hasDuplicate(name: string) {
    const variants = InsulinVariantStore.variants.value;
    for (let variant of variants) {
      if (variant.name === name) return true;
    }
    return false;
  }
  export function createVariant(
    name: string,
    duration: number,
    effect: number
  ) {
    if (hasDuplicate(name))
      throw new Error(`Cannot create insulin '${name}': already exists`);
    const variant = new InsulinVariant(name, duration, effect);
    InsulinVariantStore.variants.value = [
      ...InsulinVariantStore.variants.value,
      variant,
    ];
  }
  export function getVariant(name: string): InsulinVariant | null {
    const variants = InsulinVariantStore.variants.value;
    for (let variant of variants) {
      if (variant.name === name) return variant;
    }
    return null;
  }
  function getVariantIndex(name: string): number | null {
    const variants = InsulinVariantStore.variants.value;
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (variant.name === name) return i;
    }
    return null;
  }
  export function setDefault(name: string) {
    const index = getVariantIndex(name);
    const variant = getVariant(name);
    if (index === null || variant === null) return;
    const variants = InsulinVariantStore.variants.value;
    variants.splice(index, 1);
    variants.splice(0, 0, variant);
    InsulinVariantStore.variants.value = variants;
  }
  export function deserialize(o: any) {
    const deserialized = InsulinVariant.deserialize(o);
    const pulled = getVariant(deserialized.name);
    if (!pulled) return deserialized;
    return pulled;
  }
}
