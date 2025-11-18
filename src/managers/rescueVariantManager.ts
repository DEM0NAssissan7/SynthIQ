import { RescueVariant } from "../models/types/rescueVariant";
import { RescueVariantStore } from "../storage/rescueVariantStore";

export namespace RescueVariantManager {
  export function getDefault() {
    return RescueVariantStore.variants.value[0];
  }
  function hasDuplicate(name: string) {
    const variants = RescueVariantStore.variants.value;
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
    const variant = new RescueVariant(name, duration, effect);
    RescueVariantStore.variants.value = [
      ...RescueVariantStore.variants.value,
      variant,
    ];
  }
  export function getVariant(name: string): RescueVariant {
    const variants = RescueVariantStore.variants.value;
    for (let variant of variants) {
      if (variant.name === name) return variant;
    }
    return getDefault();
  }
  export function getOptimalVariant(
    hours: number,
    originalVariant?: RescueVariant
  ): RescueVariant {
    let optimalVariant = originalVariant ?? getDefault();
    const variants = RescueVariantStore.variants.value;
    for (let v of variants) {
      optimalVariant = v;
      if (v.duration > hours) break;
    }
    return optimalVariant;
  }
  function getVariantIndex(name: string): number | null {
    const variants = RescueVariantStore.variants.value;
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (variant.name === name) return i;
    }
    return null;
  }
  export function removeVariant(name: string) {
    const variants = RescueVariantStore.variants.value;
    if (variants.length === 1)
      throw new Error(`Can't remove the last insulin variant`);
    const index = getVariantIndex(name);
    if (index === null) return;
    variants.splice(index, 1);
    RescueVariantStore.variants.value = variants;
  }
  export function updateVariant(v: RescueVariant) {
    const index = getVariantIndex(v.name);
    if (index === null) return;
    const variants = RescueVariantStore.variants.value;
    variants[index] = v;
    RescueVariantStore.variants.value = variants;
  }
  export function setDefault(name: string) {
    const index = getVariantIndex(name);
    if (index === null || !hasDuplicate(name)) return;

    const variant = getVariant(name);
    const variants = RescueVariantStore.variants.value;
    variants.splice(index, 1);
    variants.splice(0, 0, variant);
    RescueVariantStore.variants.value = variants;
  }
  export function deserialize(o: any) {
    const deserialized = RescueVariant.deserialize(o);
    if (!hasDuplicate(deserialized.name)) return deserialized;
    const pulled = getVariant(deserialized.name);
    return pulled;
  }
}
