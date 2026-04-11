import type { InsulinVariant } from "../../models/types/insulinVariant";
import type { RescueVariant } from "../../models/types/rescueVariant";

export function useVariantGetters(
  insulinVariants: InsulinVariant[],
  rescueVariants: RescueVariant[],
) {
  const insulinVariantMap = new Map<string, InsulinVariant>();
  const rescueVariantMap = new Map<string, RescueVariant>();
  insulinVariants.forEach((v) => insulinVariantMap.set(v.name, v));
  rescueVariants.forEach((v) => rescueVariantMap.set(v.name, v));

  const getInsulinVariant = (v: InsulinVariant): InsulinVariant => {
    const variant = insulinVariantMap.get(v.name);
    if (!variant) return v;
    return variant;
  };
  const getRescueVariant = (v: RescueVariant): RescueVariant => {
    const variant = rescueVariantMap.get(v.name);
    if (!variant) return v;
    return variant;
  };

  return { getInsulinVariant, getRescueVariant };
}
