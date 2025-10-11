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
  export function getOptimalVariant(
    hours: number,
    originalVariant?: InsulinVariant
  ): InsulinVariant {
    let optimalVariant = originalVariant ?? getDefault();
    const variants = InsulinVariantStore.variants.value;
    for (let v of variants) {
      optimalVariant = v;
      if (v.duration > hours) break;
    }
    return optimalVariant;
  }
  function getVariantIndex(name: string): number | null {
    const variants = InsulinVariantStore.variants.value;
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (variant.name === name) return i;
    }
    return null;
  }
  export function removeVariant(name: string) {
    const variants = InsulinVariantStore.variants.value;
    if (variants.length === 1)
      throw new Error(`Can't remove the last insulin variant`);
    const index = getVariantIndex(name);
    if (index === null) return;
    variants.splice(index, 1);
    InsulinVariantStore.variants.value = variants;
  }
  export function updateVariant(v: InsulinVariant) {
    const index = getVariantIndex(v.name);
    if (index === null) return;
    const variants = InsulinVariantStore.variants.value;
    variants[index] = v;
    InsulinVariantStore.variants.value = variants;
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
